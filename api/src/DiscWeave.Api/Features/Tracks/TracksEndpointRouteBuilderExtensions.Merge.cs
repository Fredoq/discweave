using System.Data;
using System.Security.Cryptography;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private const string MergeTokenPurpose = "DiscWeave.TrackMerge.v1";

    private static async Task<IResult> PreviewTrackMergeAsync(
        TrackMergeRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        IDataProtectionProvider protection,
        CancellationToken cancellationToken)
    {
        if (!ValidMergeSelection(request))
        {
            return InvalidMergeSelection();
        }

        await using IDbContextTransaction transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        TrackMergePlan? plan = await TrackMergePlan.LoadAsync(context, currentCollection.CollectionId, request, cancellationToken);
        if (plan is null)
        {
            return MissingMergeTrack();
        }

        IReadOnlyList<TrackResponse> records = await ToTrackResponsesAsync(plan.SelectedTracks, context, currentCollection.CollectionId, cancellationToken);
        string fingerprint = TrackMergeSnapshot.Create(context, currentCollection.CollectionId, request, plan.Imports.FingerprintInputs, records);
        string token = protection.CreateProtector(MergeTokenPurpose).ToTimeLimitedDataProtector()
            .Protect(fingerprint, TimeSpan.FromMinutes(10));
        return Results.Ok(new TrackMergePreviewResponse(
            token, request.KeeperTrackId, [.. request.DuplicateTrackIds.Order()], records,
            plan.Counts, plan.Conflicts, "keepKeeper", plan.Conflicts.Count == 0));
    }

    private static async Task<IResult> MergeTracksAsync(
        TrackMergeRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        IDataProtectionProvider protection,
        CancellationToken cancellationToken)
    {
        if (!ValidMergeSelection(request))
        {
            return InvalidMergeSelection();
        }

        if (!request.Confirmed || string.IsNullOrWhiteSpace(request.PreviewToken))
        {
            return EndpointErrors.BadRequest("track_merge.confirmation_required", "Review and explicitly confirm the merge before continuing");
        }

        await using IDbContextTransaction transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        TrackMergePlan? plan = await TrackMergePlan.LoadAsync(context, currentCollection.CollectionId, request, cancellationToken);
        if (plan is null)
        {
            return MissingMergeTrack();
        }

        IReadOnlyList<TrackResponse> records = await ToTrackResponsesAsync(plan.SelectedTracks, context, currentCollection.CollectionId, cancellationToken);
        string fingerprint = TrackMergeSnapshot.Create(context, currentCollection.CollectionId, request, plan.Imports.FingerprintInputs, records);
        if (!MatchesMergePreview(protection, request.PreviewToken, fingerprint))
        {
            return EndpointErrors.Conflict("track_merge.preview_stale", "The collection changed or the preview expired; review a fresh merge preview");
        }

        if (plan.Conflicts.Count > 0)
        {
            return Results.Conflict(new { Code = "track_merge.conflicts", Message = "Resolve the merge conflicts before continuing", plan.Conflicts });
        }

        try
        {
            await plan.ApplyAsync(context, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Results.Ok(new TrackMergeResponse(request.KeeperTrackId, [.. request.DuplicateTrackIds.Order()]));
        }
        catch (Exception exception) when (exception is ResourceHasDependentsException or ReferencedResourceMissingException or ResourceConflictException)
        {
            return EndpointErrors.Conflict("track_merge.write_conflict", "The merge could not be saved; no changes were committed, so review a fresh preview");
        }
    }

    private static bool MatchesMergePreview(IDataProtectionProvider protection, string token, string fingerprint)
    {
        try
        {
            return protection.CreateProtector(MergeTokenPurpose).ToTimeLimitedDataProtector().Unprotect(token) == fingerprint;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    private static bool ValidMergeSelection(TrackMergeRequest request)
    {
        return request.KeeperTrackId != Guid.Empty && request.DuplicateTrackIds is { Count: > 0 and <= 100 }
            && request.DuplicateTrackIds.All(id => id != Guid.Empty && id != request.KeeperTrackId)
            && request.DuplicateTrackIds.Distinct().Count() == request.DuplicateTrackIds.Count;
    }

    private static IResult InvalidMergeSelection() => EndpointErrors.BadRequest(
        "track_merge.selection_invalid", "Choose one record to keep and between one and one hundred distinct duplicates");

    private static IResult MissingMergeTrack() => EndpointErrors.NotFound("track_merge.track_not_found", "One or more selected tracks are no longer available");
}
