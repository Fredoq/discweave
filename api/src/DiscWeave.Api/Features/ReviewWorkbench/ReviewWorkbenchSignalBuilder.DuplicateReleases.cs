using System.Globalization;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static IEnumerable<ReviewWorkbenchSignal> DuplicateReleaseSignals(
        CollectionId collectionId,
        IEnumerable<Release> releases,
        Dictionary<Guid, string> artistIdentities,
        IReadOnlyDictionary<LabelId, string> labelNames)
    {
        var groups = releases
            .Where(release => !release.IsVariousArtists && artistIdentities.ContainsKey(release.Id.Value))
            .SelectMany(release => release.Labels
                .Where(label => label.CatalogNumber is { HasValue: true } && !label.HasNoCatalogNumber)
                .Select(label => new
                {
                    Release = release,
                    label.LabelId,
                    Catalog = NormalizeReleaseDuplicateKey(label.CatalogNumber.Match(value => value, () => string.Empty))
                }))
            .Where(candidate => IsKnownCatalogNumber(candidate.Catalog))
            .GroupBy(candidate => new
            {
                Artist = artistIdentities[candidate.Release.Id.Value],
                Title = NormalizeReleaseDuplicateKey(candidate.Release.Summary.Title),
                candidate.LabelId,
                candidate.Catalog
            })
            .Where(group => group.Select(candidate => candidate.Release.Id).Distinct().Count() > 1)
            .OrderBy(group => group.Key.LabelId.Value)
            .ThenBy(group => group.Key.Catalog, StringComparer.Ordinal);
        HashSet<string> emittedKeys = [];

        foreach (var group in groups)
        {
            Release[] candidates = [.. group.Select(candidate => candidate.Release).DistinctBy(release => release.Id).OrderBy(release => release.Id.Value)];
            string labelName = labelNames.GetValueOrDefault(group.Key.LabelId, "Unknown label");
            string evidence = $"Matching title, main artist and catalog number: {labelName} / {group.Key.Catalog}";

            foreach (Release[] compatible in CompatibleReleaseGroups(candidates))
            {
                string displayTitle = compatible.Select(release => release.Summary.Title.Trim()).Order(StringComparer.OrdinalIgnoreCase).First();
                ReviewWorkbenchSignalTarget[] targets = [.. compatible.Select(release => Target(
                    ReviewWorkbenchTargetKinds.Release,
                    release.Id.Value,
                    release.Summary.Title,
                    $"{evidence} · {ReleaseEditionDetails(release)}"))];
                ReviewWorkbenchSignal signal = CreateSignal(
                    collectionId,
                    ReviewWorkbenchCategories.DuplicateCandidates,
                    ReviewWorkbenchSubtypes.DuplicateReleases,
                    $"Possible duplicate release: {displayTitle}",
                    targets,
                    displayTitle);

                // A co-release can share several label/catalog pairs but is still one candidate.
                if (emittedKeys.Add(signal.StableKey))
                {
                    yield return signal;
                }
            }
        }
    }

    private static List<Release[]> CompatibleReleaseGroups(Release[] releases)
    {
        List<Release[]> pairs = [];
        bool allCompatible = true;
        for (int i = 0; i < releases.Length; i++)
        {
            for (int j = i + 1; j < releases.Length; j++)
            {
                if (HaveCompatibleReleaseEditions(releases[i], releases[j]))
                {
                    pairs.Add([releases[i], releases[j]]);
                }
                else
                {
                    allCompatible = false;
                }
            }
        }

        // Missing metadata must not bridge two contradictory editions into one group.
        return allCompatible ? [releases] : pairs;
    }

    private static bool HaveCompatibleReleaseEditions(Release first, Release second)
    {
        ReleaseMetadata left = first.Summary.Metadata;
        ReleaseMetadata right = second.Summary.Metadata;
        string leftType = NormalizeReleaseDuplicateKey(left.Type);
        string rightType = NormalizeReleaseDuplicateKey(right.Type);
        if (leftType != "UNKNOWN" && rightType != "UNKNOWN" && leftType != rightType)
        {
            return false;
        }

        int[] years = [.. ReleaseEditionYears(left).Concat(ReleaseEditionYears(right)).Distinct()];
        bool datesConflict = left.ReleaseDate.HasValue && right.ReleaseDate.HasValue &&
            left.ReleaseDate.Match(value => value, () => default) != right.ReleaseDate.Match(value => value, () => default);
        return years.Length <= 1 && !datesConflict && !HaveConflictingReleaseSources(first, second);
    }

    private static bool HaveConflictingReleaseSources(Release first, Release second)
    {
        return first.ExternalSources.Concat(second.ExternalSources)
            .Where(source => source.ResourceType == "release")
            .GroupBy(source => source.ProviderName)
            .Any(group => group.Select(source => source.ExternalId).Distinct(StringComparer.Ordinal).Skip(1).Any());
    }

    private static IEnumerable<int> ReleaseEditionYears(ReleaseMetadata metadata)
    {
        if (metadata.Year.HasValue)
        {
            yield return metadata.Year.Match(value => value, () => 0);
        }

        if (metadata.ReleaseDate.HasValue)
        {
            yield return metadata.ReleaseDate.Match(value => value.Year, () => 0);
        }
    }

    private static string ReleaseEditionDetails(Release release)
    {
        ReleaseMetadata metadata = release.Summary.Metadata;
        string date = metadata.ReleaseDate.Match(value => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            () => metadata.Year.Match(value => value.ToString(CultureInfo.InvariantCulture), () => "Year unknown"));
        return $"{date} · {metadata.Type}";
    }

    private static bool IsKnownCatalogNumber(string value)
    {
        return value is not ("" or "-" or "NONE" or "N/A" or "UNKNOWN" or "NO CATALOG NUMBER" or "NOT APPLICABLE");
    }

    private static string NormalizeReleaseDuplicateKey(string value)
    {
        return string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).ToUpperInvariant();
    }
}
