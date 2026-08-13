using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed class OriginalVersionClassifierTests
{
    [Theory]
    [InlineData("Chase The Sun (Radio Edit)", "Chase The Sun", OriginalVersionKind.Edit)]
    [InlineData("Dreaming (Lucid's 12\" Club Mix)", "Dreaming", OriginalVersionKind.Remix)]
    [InlineData("Eugina (Michael Woods Remix)", "Eugina", OriginalVersionKind.Remix)]
    [InlineData("Track (Original Version)", "Track", OriginalVersionKind.Original)]
    [InlineData("Track (Album Mix)", "Track", OriginalVersionKind.Album)]
    [InlineData("Track (Instrumental)", "Track", OriginalVersionKind.Instrumental)]
    [InlineData("Track (Dub)", "Track", OriginalVersionKind.Dub)]
    [InlineData("Track (Live at Brixton)", "Track", OriginalVersionKind.Live)]
    [InlineData("Track (Solar Reconstruction)", "Track", OriginalVersionKind.UnclassifiedVersion)]
    public void Classify_returns_expected_base_title_and_kind(
        string title,
        string baseTitle,
        OriginalVersionKind expectedKind)
    {
        OriginalVersionClassification result = OriginalVersionClassifier.Classify(title);

        Assert.Equal(baseTitle, result.BaseTitle);
        Assert.Contains(expectedKind, result.Kinds);
    }

    [Fact]
    public void Classify_treats_a_named_mix_as_a_remix()
    {
        OriginalVersionClassification result = OriginalVersionClassifier.Classify(
            "Track (Lucid's 12\" Club Mix)");

        Assert.Contains(OriginalVersionKind.Remix, result.Kinds);
        Assert.DoesNotContain(OriginalVersionKind.Original, result.Kinds);
    }

    [Fact]
    public void Classify_treats_an_unmarked_title_as_unclassified_without_a_marker()
    {
        OriginalVersionClassification result = OriginalVersionClassifier.Classify("Track");

        Assert.Equal("Track", result.BaseTitle);
        Assert.Null(result.Marker);
        Assert.Empty(result.Kinds);
    }
}
