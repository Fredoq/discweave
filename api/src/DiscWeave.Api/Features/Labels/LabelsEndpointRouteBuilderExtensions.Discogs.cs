using System.Globalization;
using System.Text.Json;
using DiscWeave.Api.Features.ExternalMetadata;
using DiscWeave.Api.Http;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Labels;

public static partial class LabelsEndpointRouteBuilderExtensions
{
    private static void MapDiscogsEndpoints(RouteGroupBuilder group)
    {
        _ = group.MapGet("/{labelId:guid}/discogs/search", SearchDiscogsLabelsAsync);
        _ = group.MapGet("/{labelId:guid}/discogs/preferences", GetDiscogsPreferencesAsync);
        _ = group.MapPut("/{labelId:guid}/discogs/preferences", SaveDiscogsPreferencesAsync);
        _ = group.MapGet("/{labelId:guid}/discogs/catalog", GetDiscogsCatalogAsync);
    }

    private static async Task<bool> HasLabelAsync(Guid labelId, DiscWeaveDbContext context, ICurrentCollection collection, CancellationToken cancellationToken)
    {
        return await context.Labels.AnyAsync(label => label.Id == new LabelId(labelId) && label.CollectionId == collection.CollectionId, cancellationToken);
    }

    private static IResult MissingLabel()
    {
        return EndpointErrors.NotFound("label.not_found", "Label was not found");
    }

    private static async Task<IResult> SearchDiscogsLabelsAsync(Guid labelId, string? query, DiscWeaveDbContext context,
        ICurrentCollection collection, IDiscogsLabelCatalogProvider provider, CancellationToken cancellationToken)
    {
        if (!await HasLabelAsync(labelId, context, collection, cancellationToken))
        {
            return MissingLabel();
        }

        if (string.IsNullOrWhiteSpace(query) || query.Length > 200 || query.Any(char.IsControl))
        {
            return EndpointErrors.BadRequest("label.discogs.query_invalid", "Enter a label name of up to 200 characters");
        }

        ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>> result = await provider.SearchLabelsAsync(query.Trim(), cancellationToken);
        return result.IsSuccess ? Results.Ok(new { result.Value.Items, result.Value.Total }) : ExternalMetadataEndpointErrors.ToHttpResult(result.Error);
    }

    private static async Task<IResult> GetDiscogsPreferencesAsync(Guid labelId, DiscWeaveDbContext context,
        ICurrentCollection collection, LabelDiscogsPreferencesStore store, CancellationToken cancellationToken)
    {
        return !await HasLabelAsync(labelId, context, collection, cancellationToken)
            ? MissingLabel()
            : await WithPreferencesStorageAsync(async () => Results.Ok(await store.ReadAsync(collection.CollectionId, new LabelId(labelId), cancellationToken)));
    }

    private static async Task<IResult> SaveDiscogsPreferencesAsync(Guid labelId, LabelDiscogsPreferencesRequest request,
        DiscWeaveDbContext context, ICurrentCollection collection, LabelDiscogsPreferencesStore store,
        IDiscogsLabelCatalogProvider provider, CancellationToken cancellationToken)
    {
        if (!await HasLabelAsync(labelId, context, collection, cancellationToken))
        {
            return MissingLabel();
        }

        if (request.Prefixes is not { } prefixes || !ValidPreferences(request))
        {
            return EndpointErrors.BadRequest("label.discogs.preferences_invalid", "Choose a valid Discogs label and at most 50 prefixes of up to 64 characters");
        }

        LabelDiscogsPreferences preferences = LabelDiscogsPreferences.Empty;
        if (request.DiscogsLabelId is not null)
        {
            ExternalMetadataResult<DiscogsLabelCandidate> label = await provider.GetLabelAsync(request.DiscogsLabelId, cancellationToken);
            if (!label.IsSuccess)
            {
                return ExternalMetadataEndpointErrors.ToHttpResult(label.Error);
            }

            preferences = new LabelDiscogsPreferences(label.Value.ExternalId, label.Value.Name,
                [.. prefixes.Select(prefix => prefix.Trim()).Distinct(StringComparer.OrdinalIgnoreCase)]);
        }

        return await WithPreferencesStorageAsync(async () =>
        {
            await store.SaveAsync(collection.CollectionId, new LabelId(labelId), preferences, cancellationToken);
            return Results.Ok(preferences);
        });
    }

    private static bool ValidPreferences(LabelDiscogsPreferencesRequest request)
    {
        return request.Prefixes is { Length: <= 50 } && request.Prefixes.All(prefix =>
            !string.IsNullOrWhiteSpace(prefix) && prefix.Length <= 64 && !prefix.Any(char.IsControl)) &&
            (request.DiscogsLabelId is null ? request.Prefixes.Length == 0 :
                long.TryParse(request.DiscogsLabelId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0 &&
                id.ToString(CultureInfo.InvariantCulture) == request.DiscogsLabelId);
    }

    private static async Task<IResult> GetDiscogsCatalogAsync(Guid labelId, int? page, DiscWeaveDbContext context,
        ICurrentCollection collection, LabelDiscogsPreferencesStore store, IDiscogsLabelCatalogProvider provider, CancellationToken cancellationToken)
    {
        if (!await HasLabelAsync(labelId, context, collection, cancellationToken))
        {
            return MissingLabel();
        }

        int requestedPage = page ?? 1;
        return requestedPage is < 1 or > 10000
            ? EndpointErrors.BadRequest("label.discogs.page_invalid", "Page must be between 1 and 10000")
            : await WithPreferencesStorageAsync(() => LoadDiscogsCatalogAsync(new LabelId(labelId), requestedPage,
                context, collection, store, provider, cancellationToken));
    }

    private static async Task<IResult> LoadDiscogsCatalogAsync(LabelId labelId, int page, DiscWeaveDbContext context,
        ICurrentCollection collection, LabelDiscogsPreferencesStore store, IDiscogsLabelCatalogProvider provider, CancellationToken cancellationToken)
    {
        LabelDiscogsPreferences preferences = await store.ReadAsync(collection.CollectionId, labelId, cancellationToken);
        if (preferences.DiscogsLabelId is null)
        {
            return EndpointErrors.Conflict("label.discogs.not_selected", "Choose a Discogs label first");
        }

        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await provider.GetLabelReleasesAsync(preferences.DiscogsLabelId, page, cancellationToken);
        if (!result.IsSuccess)
        {
            return ExternalMetadataEndpointErrors.ToHttpResult(result.Error);
        }

        LabelDiscogsCatalogItemResponse[] items = await LabelDiscogsCatalogMatcher.MatchAsync(context, collection.CollectionId,
            labelId, result.Value.Items, cancellationToken);
        return Results.Ok(new LabelDiscogsCatalogResponse(items, result.Value.Page, result.Value.PageSize, result.Value.Total,
            result.Value.Pages, preferences.DiscogsLabelId, preferences.DiscogsLabelName ?? string.Empty));
    }

    private static async Task<IResult> WithPreferencesStorageAsync(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            return Results.Json(new ErrorResponse("label.discogs.preferences_unavailable", "Label preferences could not be read or saved"), statusCode: 503);
        }
    }
}
