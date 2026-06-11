using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Application.Catalog.Artists;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Search;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using DiscWeave.Infrastructure.Files;
using DiscWeave.Infrastructure.Identity;
using DiscWeave.Infrastructure.LocalDesktop;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
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

        DiscWeaveStorageProvider storageProvider = ResolveStorageProvider(configuration);
        LocalDesktopPaths? localDesktopPaths = null;
        if (storageProvider == DiscWeaveStorageProvider.Sqlite)
        {
            localDesktopPaths = LocalDesktopPaths.Resolve();
            localDesktopPaths.EnsureCreated();
            _ = services.AddSingleton(localDesktopPaths);
        }

        _ = services.AddDbContext<DiscWeaveDbContext>(options =>
        {
            if (storageProvider == DiscWeaveStorageProvider.Sqlite)
            {
                _ = options.UseSqlite($"Data Source={localDesktopPaths!.DatabasePath}");
                return;
            }

            string? configuredConnectionString = configuration.GetConnectionString("DiscWeave");
            if (string.IsNullOrWhiteSpace(configuredConnectionString))
            {
                throw new InvalidOperationException("Connection string 'DiscWeave' is not configured");
            }

            _ = options.UseNpgsql(configuredConnectionString);
        });
        _ = services.AddScoped<IUnitOfWork>(provider => provider.GetRequiredService<DiscWeaveDbContext>());
        _ = services.AddScoped<IArtistQueries, ArtistQueries>();
        _ = services.AddScoped<ICollectionSearchQueries, CollectionSearchQueries>();
        _ = services.Configure<ReleaseCoverStorageOptions>(configuration.GetSection("ReleaseCovers"));
        _ = services.AddSingleton<IReleaseCoverStorage, FileSystemReleaseCoverStorage>();
        _ = services.AddOptions<DiscogsOptions>()
            .Bind(configuration.GetSection("Discogs"))
            .Validate(DiscogsOptionsValidator.IsValid, "Discogs options are invalid")
            .ValidateOnStart();
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

    private static DiscWeaveStorageProvider ResolveStorageProvider(IConfiguration configuration)
    {
        string? configured = configuration["DiscWeave:StorageProvider"];
        return string.IsNullOrWhiteSpace(configured) && string.Equals(
            Environment.GetEnvironmentVariable("DISCWEAVE_RUNTIME_MODE"),
            "LocalDesktop",
            StringComparison.OrdinalIgnoreCase)
            ? DiscWeaveStorageProvider.Sqlite
            : string.Equals(configured, "Sqlite", StringComparison.OrdinalIgnoreCase)
            ? DiscWeaveStorageProvider.Sqlite
            : DiscWeaveStorageProvider.Postgres;
    }
}
