using System.Runtime.CompilerServices;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure.Tests;

public sealed class MusicBrainzOptionsTests
{
    [Fact]
    public void Shipped_enabled_configuration_validates()
    {
        string path = ApiAppSettingsPath();
        using FileStream stream = File.OpenRead(path);
        IConfiguration configuration = new ConfigurationBuilder().AddJsonStream(stream).Build();
        MusicBrainzOptions options = configuration.GetSection("MusicBrainz").Get<MusicBrainzOptions>()!;

        Assert.True(options.Enabled);
        Assert.True(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Theory]
    [InlineData("ApplicationName")]
    [InlineData("ApplicationVersion")]
    [InlineData("Contact")]
    public void Enabled_configuration_requires_each_identity_field(string field)
    {
        MusicBrainzOptions options = OptionsFrom((field, " "));

        Assert.False(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Theory]
    [InlineData("ApplicationName", "Disc(Weave")]
    [InlineData("ApplicationVersion", "1.0/0")]
    [InlineData("Contact", "maintainer)")]
    public void Enabled_configuration_rejects_identity_that_cannot_form_the_exact_User_Agent(
        string field,
        string value)
    {
        MusicBrainzOptions options = OptionsFrom((field, value));

        Assert.False(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Theory]
    [InlineData("relative")]
    [InlineData("http://musicbrainz.org")]
    [InlineData("https://user@musicbrainz.org")]
    [InlineData("https://musicbrainz.org?query=value")]
    [InlineData("https://musicbrainz.org#fragment")]
    public void Base_URL_must_be_absolute_public_Https_without_ambiguous_components(string baseUrl)
    {
        MusicBrainzOptions options = OptionsFrom(("BaseUrl", baseUrl));

        Assert.False(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Theory]
    [InlineData("MinimumRequestIntervalMilliseconds", "999")]
    [InlineData("TimeoutSeconds", "0")]
    [InlineData("TimeoutSeconds", "61")]
    [InlineData("OperationTimeoutSeconds", "9")]
    [InlineData("OperationTimeoutSeconds", "121")]
    [InlineData("MaxRetries", "-1")]
    [InlineData("MaxRetries", "4")]
    [InlineData("MaxRetryAfterSeconds", "0")]
    [InlineData("MaxRetryAfterSeconds", "31")]
    [InlineData("MaxRequestsPerOperation", "4")]
    [InlineData("MaxRequestsPerOperation", "101")]
    [InlineData("MaxRecordingCandidates", "0")]
    [InlineData("MaxRecordingCandidates", "11")]
    [InlineData("MaxLineageCandidates", "0")]
    [InlineData("MaxLineageCandidates", "11")]
    [InlineData("MaxReleasePagesPerRecording", "0")]
    [InlineData("MaxReleasePagesPerRecording", "21")]
    [InlineData("MaxReleaseGroupLookups", "-1")]
    [InlineData("MaxReleaseGroupLookups", "26")]
    public void Numeric_boundaries_are_rejected(string field, string value)
    {
        MusicBrainzOptions options = OptionsFrom((field, value));

        Assert.False(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Fact]
    public void Disabled_configuration_may_omit_identity_only()
    {
        MusicBrainzOptions options = OptionsFrom(
            ("Enabled", "false"),
            ("ApplicationName", ""),
            ("ApplicationVersion", ""),
            ("Contact", ""),
            ("MaxReleaseGroupLookups", "0"));

        Assert.True(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Theory]
    [InlineData("BaseUrl", "not-a-uri")]
    [InlineData("TimeoutSeconds", "0")]
    [InlineData("MaxRequestsPerOperation", "101")]
    public void Disabled_configuration_still_rejects_malformed_URI_and_numerics(string field, string value)
    {
        MusicBrainzOptions options = OptionsFrom(
            ("Enabled", "false"),
            ("ApplicationName", ""),
            ("ApplicationVersion", ""),
            ("Contact", ""),
            (field, value));

        Assert.False(MusicBrainzOptionsValidator.IsValid(options));
    }

    [Fact]
    public void Infrastructure_registers_scoped_MusicBrainz_provider_in_the_resolver_collection()
    {
        IConfiguration configuration = ConfigurationFromValidValues();
        ServiceCollection services = new();
        _ = services.AddSingleton(configuration);
        _ = services.AddDiscWeaveInfrastructure(configuration);
        using ServiceProvider provider = services.BuildServiceProvider(validateScopes: true);

        using IServiceScope firstScope = provider.CreateScope();
        using IServiceScope secondScope = provider.CreateScope();
        IExternalMetadataProviderResolver firstResolver =
            firstScope.ServiceProvider.GetRequiredService<IExternalMetadataProviderResolver>();
        IExternalMetadataProviderResolver secondResolver =
            secondScope.ServiceProvider.GetRequiredService<IExternalMetadataProviderResolver>();
        IExternalMetadataProvider first = firstResolver.Resolve("musicbrainz").Value;
        IExternalMetadataProvider second = secondResolver.Resolve("musicbrainz").Value;

        Assert.Equal("musicbrainz", first.ProviderCode);
        Assert.NotSame(first, second);
        Assert.Contains("discogs", firstResolver.ProviderCodes);
        Assert.Contains("musicbrainz", firstResolver.ProviderCodes);
    }

    private static MusicBrainzOptions OptionsFrom(params (string Key, string? Value)[] overrides)
    {
        IConfiguration configuration = ConfigurationFromValidValues(overrides);
        return configuration.GetSection("MusicBrainz").Get<MusicBrainzOptions>()!;
    }

    private static IConfiguration ConfigurationFromValidValues(params (string Key, string? Value)[] overrides)
    {
        Dictionary<string, string?> values = new(StringComparer.Ordinal)
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10",
            ["MusicBrainz:Enabled"] = "true",
            ["MusicBrainz:BaseUrl"] = "https://musicbrainz.org",
            ["MusicBrainz:ApplicationName"] = "DiscWeave",
            ["MusicBrainz:ApplicationVersion"] = "1.0.0",
            ["MusicBrainz:Contact"] = "https://github.com/Fredoq/discweave",
            ["MusicBrainz:TimeoutSeconds"] = "15",
            ["MusicBrainz:OperationTimeoutSeconds"] = "60",
            ["MusicBrainz:MinimumRequestIntervalMilliseconds"] = "1000",
            ["MusicBrainz:MaxRetries"] = "2",
            ["MusicBrainz:MaxRetryAfterSeconds"] = "10",
            ["MusicBrainz:MaxRequestsPerOperation"] = "40",
            ["MusicBrainz:MaxRecordingCandidates"] = "5",
            ["MusicBrainz:MaxLineageCandidates"] = "5",
            ["MusicBrainz:MaxReleasePagesPerRecording"] = "5",
            ["MusicBrainz:MaxReleaseGroupLookups"] = "10"
        };
        foreach ((string key, string? value) in overrides)
        {
            values[$"MusicBrainz:{key}"] = value;
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private static string ApiAppSettingsPath([CallerFilePath] string sourceFile = "")
    {
        string directory = Path.GetDirectoryName(sourceFile)!;
        return Path.GetFullPath(Path.Combine(directory, "..", "..", "src", "DiscWeave.Api", "appsettings.json"));
    }
}
