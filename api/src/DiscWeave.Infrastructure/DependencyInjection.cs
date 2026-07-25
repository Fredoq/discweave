using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Application.Catalog.Artists;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Search;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using DiscWeave.Infrastructure.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using DiscWeave.Infrastructure.Files;
using DiscWeave.Infrastructure.Identity;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
using DiscWeave.Infrastructure.LocalDesktop;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddDiscWeaveInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        ValidateStorageProvider(configuration);
        string? configuredConnectionString = configuration.GetConnectionString("DiscWeave");
        LocalDesktopPaths? localDesktopPaths = null;
        if (string.IsNullOrWhiteSpace(configuredConnectionString))
        {
            if (!IsLocalDesktopMode())
            {
                throw new InvalidOperationException(
                    "ConnectionStrings:DiscWeave is required unless DISCWEAVE_RUNTIME_MODE is LocalDesktop.");
            }

            localDesktopPaths = LocalDesktopPaths.Resolve();
            localDesktopPaths.EnsureCreated();
            _ = services.AddSingleton(localDesktopPaths);
        }

        _ = services.AddDbContext<DiscWeaveDbContext>(options =>
        {
            string sqliteConnectionString = string.IsNullOrWhiteSpace(configuredConnectionString)
                ? $"Data Source={localDesktopPaths!.DatabasePath}"
                : configuredConnectionString;
            _ = options.UseSqlite(sqliteConnectionString);
        });
        _ = services.AddScoped<IUnitOfWork>(provider => provider.GetRequiredService<DiscWeaveDbContext>());
        _ = services.AddScoped<IArtistQueries, ArtistQueries>();
        _ = services.AddScoped<
            ILocalOriginalCandidateDataSource,
            LocalOriginalCandidateDataSource>();
        _ = services.AddScoped<ICollectionSearchQueries, CollectionSearchQueries>();
        _ = services.Configure<ReleaseCoverStorageOptions>(configuration.GetSection("ReleaseCovers"));
        if (localDesktopPaths is not null && string.IsNullOrWhiteSpace(configuration["ReleaseCovers:StorageRoot"]))
        {
            string coverDirectory = localDesktopPaths.CoverDirectory;
            _ = services.PostConfigure<ReleaseCoverStorageOptions>(options =>
            {
                if (string.IsNullOrWhiteSpace(options.StorageRoot))
                {
                    options.StorageRoot = coverDirectory;
                }
            });
        }

        _ = services.AddSingleton<IReleaseCoverStorage, FileSystemReleaseCoverStorage>();
        _ = services.AddOptions<MusicBrainzOptions>()
            .Bind(configuration.GetSection("MusicBrainz"))
            .Validate(MusicBrainzOptionsValidator.IsValid, "MusicBrainz options are invalid")
            .ValidateOnStart();
        _ = services.AddSingleton<TimeProvider>(TimeProvider.System);
        _ = services.AddMemoryCache(options => options.SizeLimit = 512);
        _ = services.AddSingleton<IMusicBrainzRequestGate, MusicBrainzRequestGate>();
        _ = services.AddSingleton<IExternalMetadataRequestCache, ExternalMetadataRequestCache>();
        _ = services.AddOptions<DiscogsOptions>()
            .Bind(configuration.GetSection("Discogs"))
            .Validate(DiscogsOptionsValidator.IsValid, "Discogs options are invalid")
            .ValidateOnStart();
        _ = services.AddSingleton<IDiscogsIntegrationSettingsStore, DiscogsIntegrationSettingsStore>();
        _ = services.AddSingleton<IDiscogsAccessTokenProvider>(provider =>
            provider.GetRequiredService<IDiscogsIntegrationSettingsStore>());
        _ = services.AddHttpClient<DiscogsExternalMetadataProvider>((provider, client) =>
        {
            DiscogsOptions options = provider.GetRequiredService<IOptions<DiscogsOptions>>().Value;
            if (Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out Uri? baseAddress))
            {
                client.BaseAddress = baseAddress;
            }

            client.Timeout = TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 1, 60));
        });
        _ = services.AddScoped<IExternalMetadataProvider>(provider => provider.GetRequiredService<DiscogsExternalMetadataProvider>());
        _ = services.AddScoped<IExternalMetadataProviderResolver, ExternalMetadataProviderResolver>();
        _ = services.AddIdentityCore<DiscWeaveUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<DiscWeaveDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();
        _ = services.AddScoped<IUserClaimsPrincipalFactory<DiscWeaveUser>, DiscWeaveUserClaimsPrincipalFactory>();

        return services;
    }

    private static void ValidateStorageProvider(IConfiguration configuration)
    {
        string? configured = configuration["DiscWeave:StorageProvider"];
        if (string.IsNullOrWhiteSpace(configured) ||
            string.Equals(configured, "Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        throw new InvalidOperationException(
            $"DiscWeave:StorageProvider value '{configured}' is invalid. Allowed value is 'Sqlite'.");
    }

    private static bool IsLocalDesktopMode()
    {
        return string.Equals(
            Environment.GetEnvironmentVariable("DISCWEAVE_RUNTIME_MODE"),
            "LocalDesktop",
            StringComparison.OrdinalIgnoreCase);
    }
}
