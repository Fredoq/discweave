using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task EnsureTrackExternalSourceEchoesAsync(
        ReleaseImportDraftUpdateRequest request,
        ReleaseImportDraft draft,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        ReleaseImportDraftTrack[] persistedTracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == draft.CollectionId && track.DraftId == draft.Id)
            .ToArrayAsync(cancellationToken);
        if (request.Tracks is null || request.Tracks.Count != persistedTracks.Length)
        {
            throw ReadOnlyExternalSourcesException();
        }

        Dictionary<Guid, ReleaseImportDraftTrackUpdateRequest> echoedById;
        try
        {
            echoedById = request.Tracks.ToDictionary(track => track.Id);
        }
        catch (ArgumentException)
        {
            throw ReadOnlyExternalSourcesException();
        }
        foreach (ReleaseImportDraftTrack persistedTrack in persistedTracks)
        {
            if (!echoedById.TryGetValue(persistedTrack.Id.Value, out ReleaseImportDraftTrackUpdateRequest? echoed))
            {
                throw ReadOnlyExternalSourcesException();
            }

            ReleaseImportProviderReferenceMapper.EnsureEqualEcho(
                echoed.ExternalSources,
                persistedTrack.ExternalSources);
        }
    }

    private static DomainException ReadOnlyExternalSourcesException()
    {
        return new DomainException(
            "import.external_sources_read_only",
            "Every import row provenance value must be echoed unchanged");
    }
}
