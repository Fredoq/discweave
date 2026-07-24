using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed class OriginalDiscoveryTextNormalizerTests
{
    [Fact(DisplayName = "Whitespace normalization uses Unicode Form KC and collapses whitespace")]
    public void Whitespace_normalization_uses_Unicode_Form_KC_and_collapses_whitespace()
    {
        string result = OriginalDiscoveryTextNormalizer.NormalizeWhitespace("  Ｃａｆé\t\n  MIX  ");

        Assert.Equal("Café MIX", result);
    }

    [Fact(DisplayName = "Title keys treat composed and decomposed characters equally")]
    public void Title_keys_treat_composed_and_decomposed_characters_equally()
    {
        string composed = OriginalDiscoveryTextNormalizer.ForTitleKey("Café");
        string decomposed = OriginalDiscoveryTextNormalizer.ForTitleKey("Cafe\u0301");

        Assert.Equal("café", composed);
        Assert.Equal(composed, decomposed);
    }

    [Fact(DisplayName = "Title keys use invariant case and fold punctuation and symbols")]
    public void Title_keys_use_invariant_case_and_fold_punctuation_and_symbols()
    {
        string result = OriginalDiscoveryTextNormalizer.ForTitleKey("  It's—Like+THAT  ");

        Assert.Equal("it s like that", result);
    }

    [Fact(DisplayName = "Artist keys fold punctuation symbols and whitespace")]
    public void Artist_keys_fold_punctuation_symbols_and_whitespace()
    {
        string result = OriginalDiscoveryTextNormalizer.ForArtistKey("  AC/DC & D.J.  ");

        Assert.Equal("ac dc d j", result);
    }

    [Fact(DisplayName = "Parser tokens preserve punctuation while normalizing compatibility case and whitespace")]
    public void Parser_tokens_preserve_punctuation_while_normalizing_compatibility_case_and_whitespace()
    {
        string result = OriginalDiscoveryTextNormalizer.ForParserToken("  Ｉｔ'ｓ--Ｌｉｋｅ:THAT  ");

        Assert.Equal("it's--like:that", result);
    }

    [Fact(DisplayName = "Version marker matching separates only the terminal parenthetical")]
    public void Version_marker_matching_separates_only_the_terminal_parenthetical()
    {
        OriginalVersionMarkerMatcher.TitleToken? result =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical("Café (Live) (Radio Edit)");

        Assert.NotNull(result);
        Assert.Equal("Café (Live)", result.BaseTitle);
        Assert.Equal("Radio Edit", result.Token);
    }
}
