using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Settings;

public sealed class TrackStackSettingsTests
{
    [Fact(DisplayName = "Track stack settings normalize and deduplicate relation type codes")]
    public void Track_stack_settings_normalize_and_deduplicate_relation_type_codes()
    {
        var settings = TrackStackSettings.Create(
            CollectionId.New(),
            [" remixOf ", "dubVersionOf", "remixOf"]);

        Assert.Equal(["remixOf", "dubVersionOf"], settings.DefaultRelationTypeCodes);

        settings.UpdateDefaultRelationTypeCodes(["versionOf", " remixOf "]);

        Assert.Equal(["versionOf", "remixOf"], settings.DefaultRelationTypeCodes);
    }

    [Theory(DisplayName = "Track stack settings require code-like relation type codes")]
    [InlineData("bad code")]
    [InlineData("bad.code")]
    public void Track_stack_settings_require_code_like_relation_type_codes(string relationTypeCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() =>
            TrackStackSettings.Create(CollectionId.New(), [relationTypeCode]));

        Assert.Equal("track_stack_settings.relation_type_invalid", exception.Code);
    }
}
