using DiscWeave.Api.Auth;
using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.Artists;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Artists;

public static partial class ArtistsEndpointRouteBuilderExtensions
{
    private const int DefaultLimit = 50;
    private const int MaximumLimit = 100;

    public static IEndpointRouteBuilder MapArtistsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/artists")
            .WithTags("Artists")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapPost("/", CreateArtistAsync)
            .WithName("CreateArtist");
        _ = group.MapGet("/{artistId:guid}", GetArtistAsync)
            .WithName("GetArtist");
        _ = group.MapGet("", ListArtistsAsync)
            .WithName("ListArtists");
        _ = group.MapPut("/{artistId:guid}", UpdateArtistAsync)
            .WithName("UpdateArtist");
        _ = group.MapDelete("/{artistId:guid}", DeleteArtistAsync)
            .WithName("DeleteArtist");

        return endpoints;
    }

    private static async Task<IResult> CreateArtistAsync(
        CreateArtistRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            DiscogsArtistApplyWorkflow.ValidateDiscogsArtist(request.DiscogsArtist);
            string normalizedType = DiscogsArtistApplyWorkflow.TypeFromRequest(request.Type, request.DiscogsArtist);
            Artist artist = CreateArtist(currentCollection.CollectionId, normalizedType, request.Name);
            IReadOnlyList<ExternalSourceReferenceRequest>? externalSources = request.DiscogsArtist is null
                ? request.ExternalSources
                : DiscogsArtistApplyWorkflow.UpsertDiscogsExternalSources(request.ExternalSources, request.DiscogsArtist);
            artist.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(externalSources, DateTimeOffset.UtcNow));

            await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
                await context.Database.BeginTransactionAsync(cancellationToken);
            IRepository<Artist, ArtistId> artists = unitOfWork.GetRepository<Artist, ArtistId>();
            artists.Add(artist);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            DiscogsArtistApplySummaryResponse? memberSummary = await DiscogsArtistApplyWorkflow.ApplyMembersAsync(
                context,
                currentCollection.CollectionId,
                artist,
                request.DiscogsArtist,
                cancellationToken);
            DiscogsArtistApplySummaryResponse? aliasSummary = await DiscogsArtistApplyWorkflow.ApplyRealNameAliasAsync(
                context,
                currentCollection.CollectionId,
                artist,
                request.DiscogsArtist,
                cancellationToken);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            DiscogsArtistApplySummaryResponse? summary = DiscogsArtistApplyWorkflow.CombineSummaries(memberSummary, aliasSummary);
            ArtistResponse response = ToResponse(artist, summary);
            return Results.Created($"/api/artists/{response.Id}", response);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ResourceConflictException exception) when (exception.Conflict == ResourceConflictException.ArtistAliasOfRelation)
        {
            return EndpointErrors.BadRequest(DiscogsArtistApplyWorkflow.AliasOfConflictCode, DiscogsArtistApplyWorkflow.AliasOfConflictMessage);
        }
    }

    private static async Task<IResult> GetArtistAsync(
        Guid artistId,
        IArtistQueries artistQueries,
        CancellationToken cancellationToken)
    {
        ArtistReadModel? artist = await artistQueries.TryGetAsync(new ArtistId(artistId), cancellationToken);

        return artist is null
            ? EndpointErrors.NotFound("artist.not_found", "Artist was not found")
            : Results.Ok(ToResponse(artist));
    }

    private static async Task<IResult> ListArtistsAsync(
        string? search,
        string? type,
        int? limit,
        int? offset,
        IArtistQueries artistQueries,
        CancellationToken cancellationToken)
    {
        string normalizedType = string.IsNullOrWhiteSpace(type) ? string.Empty : type.Trim();
        if (!string.IsNullOrEmpty(normalizedType) && !IsKnownArtistType(normalizedType))
        {
            return EndpointErrors.BadRequest("artist.type_invalid", "Artist type is invalid");
        }

        int normalizedLimit = limit ?? DefaultLimit;
        int normalizedOffset = offset ?? 0;
        if (normalizedLimit < 1 || normalizedLimit > MaximumLimit || normalizedOffset < 0)
        {
            return EndpointErrors.BadRequest("pagination.invalid", "Pagination values are invalid");
        }

        ArtistListResult result = await artistQueries.ListAsync(
            new ArtistListQuery(search?.Trim() ?? string.Empty, normalizedType, normalizedLimit, normalizedOffset),
            cancellationToken);

        ArtistListResponse response = new(
            [.. result.Items.Select(ToResponse)],
            result.Limit,
            result.Offset,
            result.Total);

        return Results.Ok(response);
    }

    private static async Task<IResult> UpdateArtistAsync(
        Guid artistId,
        UpdateArtistRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        Artist? artist = await context.Artists.SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new ArtistId(artistId),
            cancellationToken);
        if (artist is null)
        {
            return EndpointErrors.NotFound("artist.not_found", "Artist was not found");
        }

        try
        {
            DiscogsArtistApplyWorkflow.ValidateDiscogsArtist(request.DiscogsArtist);
            string normalizedType = DiscogsArtistApplyWorkflow.TypeFromRequest(
                request.Type ?? CurrentArtistType(artist),
                request.DiscogsArtist);
            await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
                await context.Database.BeginTransactionAsync(cancellationToken);

            artist.Rename(request.Name);
            if (request.DiscogsArtist is not null)
            {
                IReadOnlyList<ExternalSourceReferenceRequest> externalSources =
                    DiscogsArtistApplyWorkflow.UpsertDiscogsExternalSources(
                        request.ExternalSources ?? ExternalSourceReferenceMapper.ToRequests(artist.ExternalSources),
                        request.DiscogsArtist);
                artist.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(
                    externalSources,
                    DateTimeOffset.UtcNow,
                    artist.ExternalSources));
            }
            else if (request.ExternalSources is not null)
            {
                artist.ReplaceExternalSources(ExternalSourceReferenceMapper.FromRequests(request.ExternalSources, DateTimeOffset.UtcNow));
            }

            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            if (normalizedType != CurrentArtistType(artist))
            {
                int affectedRows = await context.Database.ExecuteSqlInterpolatedAsync(
                    $"""
                    UPDATE "artists"
                    SET "artist_type" = {normalizedType}
                    WHERE "collection_id" = {currentCollection.CollectionId.Value}
                        AND "artist_id" = {artist.Id.Value}
                    """,
                    cancellationToken);
                if (affectedRows != 1)
                {
                    throw new InvalidOperationException("Expected exactly one artist row to be updated");
                }

                MarkArtistForSearchDocumentRefresh(context, artist);
            }

            DiscogsArtistApplySummaryResponse? memberSummary = normalizedType == "group"
                ? await DiscogsArtistApplyWorkflow.ApplyMembersAsync(
                    context,
                    currentCollection.CollectionId,
                    artist,
                    request.DiscogsArtist,
                    cancellationToken)
                : null;
            DiscogsArtistApplySummaryResponse? aliasSummary = await DiscogsArtistApplyWorkflow.ApplyRealNameAliasAsync(
                context,
                currentCollection.CollectionId,
                artist,
                request.DiscogsArtist,
                cancellationToken);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            DiscogsArtistApplySummaryResponse? summary = DiscogsArtistApplyWorkflow.CombineSummaries(memberSummary, aliasSummary);
            return Results.Ok(ToResponse(artist, normalizedType, summary));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ResourceConflictException exception) when (exception.Conflict == ResourceConflictException.ArtistAliasOfRelation)
        {
            return EndpointErrors.BadRequest(DiscogsArtistApplyWorkflow.AliasOfConflictCode, DiscogsArtistApplyWorkflow.AliasOfConflictMessage);
        }
    }

    private static async Task<IResult> DeleteArtistAsync(
        Guid artistId,
        HttpRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!DeleteConfirmation.Matches(request, "artist", artistId))
        {
            return EndpointErrors.DeleteConfirmationRequired();
        }

        Artist? artist = await context.Artists.SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new ArtistId(artistId),
            cancellationToken);
        if (artist is null)
        {
            return EndpointErrors.NotFound("artist.not_found", "Artist was not found");
        }

        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
            await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            Credit[] credits = await context.Credits
                .Where(credit =>
                    credit.CollectionId == currentCollection.CollectionId &&
                    EF.Property<ArtistId>(credit, "_contributorArtistId") == artist.Id)
                .ToArrayAsync(cancellationToken);
            ArtistRelation[] relations = await context.ArtistRelations
                .Where(relation =>
                    relation.CollectionId == currentCollection.CollectionId &&
                    (relation.SourceArtistId == artist.Id || relation.TargetArtistId == artist.Id))
                .ToArrayAsync(cancellationToken);

            context.Credits.RemoveRange(credits);
            context.ArtistRelations.RemoveRange(relations);
            _ = context.Artists.Remove(artist);

            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Results.NoContent();
        }
        catch (ResourceHasDependentsException)
        {
            return EndpointErrors.Conflict("artist.delete_conflict", "Artist has dependent data");
        }
    }

}
