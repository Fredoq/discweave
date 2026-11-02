using DiscWeave.Api.Auth;
using DiscWeave.Api.Features.ExternalMetadata;
using DiscWeave.Api.Http;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Security;

namespace DiscWeave.Api.Features.Discover;

public static class DiscoverEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapDiscoverEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints.MapGroup("/api/discover").WithTags("Discover")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);
        _ = group.MapGet("/profile", ProfileAsync);
        _ = group.MapPost("/resolve", ResolveAsync);
        _ = group.MapPost("/feedback", FeedbackAsync);
        return endpoints;
    }

    private static async Task<IResult> ProfileAsync(string? seed, string? mode, Guid? releaseId, Guid? trackId,
        DiscoverProfileService service, ICurrentCollection collection, CancellationToken cancellationToken)
    {
        if (seed?.Length > 128 || mode is not (null or "familiar" or "adventurous") || (releaseId.HasValue && trackId.HasValue))
        {
            return EndpointErrors.BadRequest("discover.request_invalid", "Discover request is invalid");
        }

        DiscoverProfileResponse? profile = await service.CreateAsync(collection.CollectionId, seed ?? Guid.CreateVersion7().ToString(),
            mode ?? "familiar", releaseId, trackId, cancellationToken);
        return profile is null ? EndpointErrors.NotFound("discover.context_not_found", "Context was not found") : Results.Ok(profile);
    }

    private static async Task<IResult> ResolveAsync(DiscoverResolveRequest request, DiscoverSnapshots snapshots,
        DiscoverResolver resolver, ICurrentCollection collection, CancellationToken cancellationToken)
    {
        if (request.ProfileToken is not { Length: 64 } || request.Leads is not { Count: > 0 and <= 20 } ||
            request.Leads.Any(lead => lead is null || !ValidText(lead.Artist) || !ValidText(lead.Title)))
        {
            return EndpointErrors.BadRequest("discover.request_invalid", "Discover leads are invalid");
        }

        if (!snapshots.TryBegin(collection.CollectionId))
        {
            return EndpointErrors.Conflict("discover.generation_in_progress", "A recommendation request is already in progress");
        }

        try
        {
            return await ResolveSnapshotAsync(request, snapshots, resolver, collection, cancellationToken);
        }
        finally
        {
            snapshots.End(collection.CollectionId);
        }
    }

    private static async Task<IResult> ResolveSnapshotAsync(DiscoverResolveRequest request, DiscoverSnapshots snapshots,
        DiscoverResolver resolver, ICurrentCollection collection, CancellationToken cancellationToken)
    {
        DiscoverSnapshot? snapshot = snapshots.Take(request.ProfileToken, collection.CollectionId);
        if (snapshot is null)
        {
            return EndpointErrors.Conflict("discover.profile_expired", "Generate a fresh taste profile before resolving suggestions");
        }

        ExternalMetadataResult<DiscoverResult> result = await resolver.ResolveAsync(snapshot, request.Leads, cancellationToken);
        return result.IsSuccess ? Results.Ok(result.Value) : ExternalMetadataEndpointErrors.ToHttpResult(result.Error);
    }

    private static async Task<IResult> FeedbackAsync(DiscoverFeedbackRequest request, DiscoverHistoryStore history,
        ICurrentCollection collection, TimeProvider time, CancellationToken cancellationToken)
    {
        if (request.Kind is not ("notInterested" or "alreadyKnow") || !ValidText(request.ExternalId))
        {
            return EndpointErrors.BadRequest("discover.feedback_invalid", "Discover feedback is invalid");
        }

        DiscoverHistoryEntry[] entries = await history.ReadAsync(collection.CollectionId, cancellationToken);
        DiscoverHistoryEntry? existing = entries.FirstOrDefault(entry => entry.ExternalId == request.ExternalId);
        if (existing is null)
        {
            return EndpointErrors.NotFound("discover.release_not_shown", "Release was not shown in this collection");
        }

        bool saved = await history.RecordAsync(collection.CollectionId,
            [existing with { Kind = request.Kind, At = time.GetUtcNow() }], true, cancellationToken);
        return saved ? Results.NoContent() : EndpointErrors.NotFound("discover.release_not_shown", "Release was not shown in this collection");
    }

    private static bool ValidText(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 200 && !value.Any(char.IsControl);
}
