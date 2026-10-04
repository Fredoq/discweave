using DiscWeave.Application.ExternalSources;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private sealed partial class SuggestionLookup
    {
        private readonly Artist[] _artists;
        private readonly Track[] _tracks;

        private SuggestionLookup(Artist[] artists, Track[] tracks)
        {
            _artists = artists;
            _tracks = tracks;
        }

        public static async Task<SuggestionLookup> LoadAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            CancellationToken cancellationToken)
        {
            Artist[] artists = await context.Artists.AsNoTracking()
                .Include("_externalSources")
                .Where(artist => artist.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken);
            Track[] tracks = await context.Tracks.AsNoTracking().Where(track => track.CollectionId == collectionId).ToArrayAsync(cancellationToken);

            return new SuggestionLookup(artists, tracks);
        }

        public IReadOnlyList<Track> ExistingTracks => _tracks;

        public IReadOnlyList<EntitySuggestionResponse> ForArtists(IReadOnlyList<string> names)
        {
            return [.. names
                .SelectMany(name => Match(_artists, name, artist => artist.Id.Value, artist => artist.Name, ArtistIdentityHint))
                .DistinctBy(suggestion => suggestion.Id)];
        }

        public IReadOnlyList<EntitySuggestionResponse> ForTracks(string title)
        {
            return [.. Match(_tracks, title, track => track.Id.Value, track => track.Title).Take(5)];
        }

        private static IEnumerable<EntitySuggestionResponse> Match<T>(
            IEnumerable<T> entities,
            string value,
            Func<T, Guid> id,
            Func<T, string> name,
            Func<T, string?>? identityHint = null)
        {
            string normalized = Normalize(value);
            string baseTitle = WithoutBracketedSuffixes(normalized);
            return entities
                .Select(entity => new { Entity = entity, Normalized = Normalize(name(entity)) })
                .Where(candidate =>
                    candidate.Normalized.Contains(normalized, StringComparison.Ordinal) ||
                    (baseTitle.Length > 0 && WithoutBracketedSuffixes(candidate.Normalized) == baseTitle))
                .Select(candidate => new EntitySuggestionResponse(
                    id(candidate.Entity),
                    name(candidate.Entity),
                    candidate.Normalized == normalized ? "exact" : "close",
                    identityHint?.Invoke(candidate.Entity)));
        }

        private static string? ArtistIdentityHint(Artist artist)
        {
            return ExternalSourceIdentityHintFormatter.ArtistIdentityHint(artist.ExternalSources);
        }

        private static string Normalize(string value)
        {
            string folded = value
                .Replace('\u2019', '\'')
                .Replace('\u2018', '\'')
                .Replace('\u02BC', '\'')
                .Replace('\u201C', '"')
                .Replace('\u201D', '"');
            return string.Join(' ', folded.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }

        // "We'll Be Coming Back (Feat. Example)" and "We'll Be Coming Back (Original Mix)"
        // name the same recording family; bracketed version or credit suffixes must not hide it.
        private static string WithoutBracketedSuffixes(string normalized)
        {
            return string.Join(' ', BracketedSegment().Replace(normalized, " ").Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }

        [System.Text.RegularExpressions.GeneratedRegex(@"\([^)]*\)|\[[^\]]*\]")]
        private static partial System.Text.RegularExpressions.Regex BracketedSegment();
    }
}
