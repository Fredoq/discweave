namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalVersionClassifier
{
    private static readonly string[] EditMarkers =
    [
        "edit",
        "radio edit",
        "single edit"
    ];

    private static readonly string[] RemixMarkers =
    [
        "remix",
        "mix",
        "club mix",
        "extended mix",
        "extended club mix",
        "rework"
    ];

    private static readonly string[] InstrumentalMarkers = ["instrumental"];
    private static readonly string[] DubMarkers = ["dub"];
    private static readonly string[] LiveMarkers = ["live"];
    private static readonly string[] OriginalMarkers = ["original", "original version", "original mix"];
    private static readonly string[] AlbumMarkers = ["album", "album version", "album mix"];

    public static OriginalVersionClassification Classify(string title)
    {
        ArgumentNullException.ThrowIfNull(title);

        OriginalVersionMarkerMatcher.TitleToken? token =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical(title);
        if (token is null)
        {
            return new OriginalVersionClassification
            {
                BaseTitle = title.Trim(),
                Kinds = new HashSet<OriginalVersionKind>()
            };
        }

        string normalized = OriginalDiscoveryTextNormalizer.ForParserToken(token.Token);
        HashSet<OriginalVersionKind> kinds = [];

        if (ContainsMarker(normalized, EditMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Edit);
        }

        if (ContainsMarker(normalized, RemixMarkers) &&
            !string.Equals(normalized, "original mix", StringComparison.Ordinal))
        {
            _ = kinds.Add(OriginalVersionKind.Remix);
        }

        if (ContainsMarker(normalized, InstrumentalMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Instrumental);
        }

        if (ContainsMarker(normalized, DubMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Dub);
        }

        if (ContainsMarker(normalized, LiveMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Live);
        }

        if (ContainsMarker(normalized, OriginalMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Original);
        }

        if (ContainsMarker(normalized, AlbumMarkers))
        {
            _ = kinds.Add(OriginalVersionKind.Album);
        }

        if (kinds.Count == 0)
        {
            _ = kinds.Add(OriginalVersionKind.UnclassifiedVersion);
        }

        return new OriginalVersionClassification
        {
            BaseTitle = token.BaseTitle,
            Marker = token.Token,
            Kinds = kinds
        };
    }

    public static bool IsCompatible(
        IReadOnlySet<OriginalVersionKind> sourceKinds,
        IReadOnlySet<OriginalVersionKind> candidateKinds)
    {
        ArgumentNullException.ThrowIfNull(sourceKinds);
        ArgumentNullException.ThrowIfNull(candidateKinds);

        return !candidateKinds.Contains(OriginalVersionKind.UnclassifiedVersion)
            && (sourceKinds.Contains(OriginalVersionKind.Edit)
                ? !candidateKinds.Contains(OriginalVersionKind.Live)
                    && !candidateKinds.Contains(OriginalVersionKind.Remix)
                    && !candidateKinds.Contains(OriginalVersionKind.Instrumental)
                    && !candidateKinds.Contains(OriginalVersionKind.Dub)
                : sourceKinds.Contains(OriginalVersionKind.Remix)
                    ? !candidateKinds.Contains(OriginalVersionKind.Remix)
                        && !candidateKinds.Contains(OriginalVersionKind.Edit)
                        && !candidateKinds.Contains(OriginalVersionKind.Live)
                    : sourceKinds.Contains(OriginalVersionKind.Instrumental)
                        || sourceKinds.Contains(OriginalVersionKind.Dub)
                        ? !candidateKinds.Contains(OriginalVersionKind.Instrumental)
                            && !candidateKinds.Contains(OriginalVersionKind.Dub)
                            && !candidateKinds.Contains(OriginalVersionKind.Remix)
                        : sourceKinds.Contains(OriginalVersionKind.Live)
                            ? !candidateKinds.Contains(OriginalVersionKind.Live)
                            : candidateKinds.Contains(OriginalVersionKind.Original)
                                || candidateKinds.Contains(OriginalVersionKind.Album)
                                || candidateKinds.Count == 0);
    }

    private static bool ContainsMarker(string normalized, IEnumerable<string> markers)
    {
        return markers.Any(marker =>
            string.Equals(normalized, marker, StringComparison.Ordinal) ||
            normalized.EndsWith($" {marker}", StringComparison.Ordinal) ||
            normalized.StartsWith($"{marker} ", StringComparison.Ordinal));
    }
}
