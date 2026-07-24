namespace DiscWeave.Domain.Imports;

public sealed partial class ReleaseImportDraft
{
    private static List<ReleaseImportArtistCredit> NormalizeArtistCredits(
        IReadOnlyList<ReleaseImportArtistCredit>? artistCredits,
        IReadOnlyList<string> artistNames,
        IReadOnlyList<Guid> selectedArtistIds)
    {
        if (artistCredits is { Count: > 0 })
        {
            return
            [
                .. artistCredits
                    .Select(credit => new ReleaseImportArtistCredit(
                        credit.ArtistId,
                        TrimOrNull(credit.Name) ?? string.Empty,
                        TrimOrNull(credit.Role) ?? string.Empty,
                        NormalizeArtistCreditExternalSource(credit.ExternalSource)))
                    .Where(credit =>
                        credit.ArtistId is not null ||
                        !string.IsNullOrWhiteSpace(credit.Name) ||
                        credit.ExternalSource is not null)
            ];
        }

        List<ReleaseImportArtistCredit> credits = [];
        for (int index = 0; index < artistNames.Count; index++)
        {
            string? name = TrimOrNull(artistNames[index]);
            Guid? artistId = index < selectedArtistIds.Count ? selectedArtistIds[index] : null;
            if (artistId is null && string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            credits.Add(new ReleaseImportArtistCredit(artistId, name ?? string.Empty, "mainArtist", null));
        }

        return credits;
    }

    private static ReleaseImportArtistCreditExternalSource? NormalizeArtistCreditExternalSource(
        ReleaseImportArtistCreditExternalSource? source)
    {
        return ReleaseImportArtistCreditExternalSourceNormalizer.Normalize(source);
    }

    private static List<ReleaseImportLabel> NormalizeLabels(
        IReadOnlyList<ReleaseImportLabel>? labels,
        string? legacyLabelName,
        string? legacyCatalogNumber)
    {
        if (labels is { Count: > 0 })
        {
            return
            [
                .. labels
                    .Select(label => new ReleaseImportLabel(
                        label.LabelId,
                        TrimOrNull(label.Name) ?? string.Empty,
                        TrimOrNull(label.CatalogNumber),
                        label.HasNoCatalogNumber))
                    .Where(label => label.LabelId is not null || !string.IsNullOrWhiteSpace(label.Name))
            ];
        }

        string? labelName = TrimOrNull(legacyLabelName);
        return labelName is null
            ? []
            : [new ReleaseImportLabel(null, labelName, TrimOrNull(legacyCatalogNumber), string.IsNullOrWhiteSpace(legacyCatalogNumber))];
    }
}
