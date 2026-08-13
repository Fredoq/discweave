using System.Reflection;
using DiscWeave.Api.Features.Imports;
using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed class ExternalReleaseBindingValidationResultTests
{
    [Fact]
    public void All_result_variants_have_non_public_constructors()
    {
        Type[] variants =
        [
            typeof(ExternalReleaseBindingValidationResult.MusicBrainzValid),
            typeof(ExternalReleaseBindingValidationResult.DiscogsBackedValid),
            typeof(ExternalReleaseBindingValidationResult.StaleBinding),
            typeof(ExternalReleaseBindingValidationResult.AmbiguousBinding),
            typeof(ExternalReleaseBindingValidationResult.ProviderFailed)
        ];

        Assert.All(
            variants,
            variant => Assert.All(
                variant.GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance),
                constructor => Assert.False(constructor.IsPublic)));
    }

    [Fact]
    public void Provider_failure_uses_stable_fallback_code_when_status_has_no_error_code()
    {
        var status = new ExternalProviderOperationStatus
        {
            ProviderCode = "musicbrainz",
            Outcome = ExternalProviderOperationOutcome.Timeout
        };

        ExternalReleaseBindingValidationResult.ProviderFailed result =
            ExternalReleaseBindingValidationResult.ProviderFailure(status);

        Assert.Equal(ExternalReleaseBindingValidationOutcome.ProviderFailure, result.Outcome);
        Assert.Equal("external_metadata.timeout", result.Code);
        Assert.Same(status, result.Status);
    }

    [Fact]
    public void Stale_and_ambiguous_results_expose_only_their_stable_error_codes()
    {
        ExternalReleaseBindingValidationResult.StaleBinding stale =
            ExternalReleaseBindingValidationResult.Stale();
        ExternalReleaseBindingValidationResult.AmbiguousBinding ambiguous =
            ExternalReleaseBindingValidationResult.Ambiguous();

        Assert.Equal("import.external_binding_stale", stale.Code);
        Assert.Equal("import.external_binding_ambiguous", ambiguous.Code);
    }
}
