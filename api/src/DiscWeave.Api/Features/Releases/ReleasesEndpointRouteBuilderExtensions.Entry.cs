using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Application.Errors;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task<Release> CreateReleaseEntryAsync(
        ReleaseRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Release release = await ApplyReleaseRequestAsync(
            Release.Create(collectionId, ReleaseId.New(), request.Title),
            request,
            context,
            collectionId,
            cancellationToken);
        IReadOnlyList<ResolvedCredit> releaseCredits = await ResolveCreditsAsync(
            request.ArtistCredits,
            context,
            collectionId,
            cancellationToken);

        if (!request.IsVariousArtists && releaseCredits.All(credit => !credit.Roles.Contains("mainArtist", StringComparer.Ordinal)))
        {
            throw new DomainException("release.artist_required", "Release artist is required unless the release is marked as Various Artists");
        }

        IReadOnlyList<ReleaseLabel> labels = await ResolveLabelsAsync(request, context, collectionId, cancellationToken);
        release.UpdateLabels(request.NotOnLabel, labels);
        release.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(request.ExternalSources, DateTimeOffset.UtcNow));
        _ = context.Releases.Add(release);

        foreach (ResolvedCredit credit in releaseCredits)
        {
            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForRelease(release.Id), credit.Roles));
        }

        await ReplaceReleaseTracklistAsync(request, release, releaseCredits, context, collectionId, cancellationToken);
        await CreateOwnedCopiesAsync(request, release, context, collectionId, cancellationToken);

        return release;
    }

    private static async Task<IReadOnlyList<ReleaseLabel>> ResolveLabelsAsync(
        ReleaseRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (request.NotOnLabel)
        {
            return [];
        }

        var labels = new List<ReleaseLabel>();
        if (request.Labels is { Count: > 0 })
        {
            foreach (ReleaseLabelRequest labelRequest in request.Labels)
            {
                Label label = await ResolveLabelAsync(labelRequest, context, collectionId, cancellationToken);
                labels.Add(ReleaseLabel.Create(label.Id, ToOptionalString(labelRequest.CatalogNumber), labelRequest.HasNoCatalogNumber));
            }
        }
        else if (request.LabelId is { } labelId)
        {
            Label? label = await context.Labels.SingleOrDefaultAsync(
                record => record.CollectionId == collectionId && record.Id == new LabelId(labelId),
                cancellationToken);
            _ = label ?? throw new ReferencedResourceMissingException(new InvalidOperationException(LabelMissingMessage));

            labels.Add(ReleaseLabel.Create(label.Id, Optional.Missing<string>(), false));
        }

        return labels;
    }

    private static async Task<Label> ResolveLabelAsync(
        ReleaseLabelRequest labelRequest,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (labelRequest.LabelId is { } labelId)
        {
            Label? existing = await context.Labels.SingleOrDefaultAsync(
                label => label.CollectionId == collectionId && label.Id == new LabelId(labelId),
                cancellationToken);

            return existing ?? throw new ReferencedResourceMissingException(new InvalidOperationException(LabelMissingMessage));
        }

        if (string.IsNullOrWhiteSpace(labelRequest.Name))
        {
            throw new DomainException("release_label.name_required", "Release label name is required");
        }

        string name = LabelName.NormalizeDisplayName(labelRequest.Name);
        string nameKey = LabelName.NormalizeKey(name);
        Label? existingByName = context.Labels.Local.FirstOrDefault(label => label.CollectionId == collectionId && label.NameKey == nameKey);
        existingByName ??= await context.Labels.SingleOrDefaultAsync(
            label => label.CollectionId == collectionId && label.NameKey == nameKey,
            cancellationToken);

        if (existingByName is not null)
        {
            return existingByName;
        }

        var created = Label.Create(collectionId, LabelId.New(), name);
        _ = context.Labels.Add(created);

        return created;
    }

    private static IOptionalValue<string> ToOptionalString(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? Optional.Missing<string>()
            : Optional.From(value.Trim());
    }

    private static async Task ReplaceReleaseCreditsAsync(
        Release release,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Credit[] releaseCreditsToRemove = await context.Credits
            .Where(credit =>
                credit.CollectionId == collectionId &&
                EF.Property<ReleaseId?>(credit, "_targetReleaseId") == release.Id)
            .ToArrayAsync(cancellationToken);
        context.Credits.RemoveRange(releaseCreditsToRemove);

        foreach (ResolvedCredit credit in releaseCredits)
        {
            _ = context.Credits.Add(Credit.Create(collectionId, CreditId.New(), CreditContributor.FromArtist(credit.Artist), CreditTarget.ForRelease(release.Id), credit.Roles));
        }
    }

}
