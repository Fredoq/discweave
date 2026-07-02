namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportDiscogsProvenanceTests
{
    private static object ReviewedDraftPayloadWithArtistSource(Guid trackId, string artistExternalId)
    {
        return new
        {
            title = "Show Me Love",
            type = "single",
            catalogNumber = "SHOW 01",
            labelName = (string?)null,
            releaseDate = "1993-01-01",
            year = 1993,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = Array.Empty<string>(),
            artistCredits = new object[]
            {
                new
                {
                    artistId = (Guid?)null,
                    name = "Robin Stone",
                    role = "mainArtist",
                    externalSource = ArtistSource(artistExternalId)
                }
            },
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "Champion", catalogNumber = "SHOW 01", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            coverPath = (string?)null,
            externalSources = new[] { DiscogsSource() },
            tracks = new object[]
            {
                new
                {
                    id = trackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Show Me Love",
                    durationSeconds = (int?)300,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }

    private static object ReviewedDraftPayloadWithSelectedArtistAndTrackArtistSource(
        Guid trackId,
        Guid selectedArtistId,
        string artistExternalId)
    {
        return new
        {
            title = "Show Me Love",
            type = "single",
            catalogNumber = "SHOW 01",
            labelName = (string?)null,
            releaseDate = "1993-01-01",
            year = 1993,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = Array.Empty<string>(),
            artistCredits = new object[]
            {
                new
                {
                    artistId = selectedArtistId,
                    name = "Robin Stone",
                    role = "mainArtist",
                    externalSource = ArtistSource(artistExternalId)
                }
            },
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "Champion", catalogNumber = "SHOW 01", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            coverPath = (string?)null,
            externalSources = new[] { DiscogsSource() },
            tracks = new object[]
            {
                new
                {
                    id = trackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Show Me Love",
                    durationSeconds = (int?)300,
                    artistNames = Array.Empty<string>(),
                    artistCredits = new object[]
                    {
                        new
                        {
                            artistId = (Guid?)null,
                            name = "Robin Stone",
                            role = "mainArtist",
                            externalSource = ArtistSource(artistExternalId)
                        }
                    },
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }

    private static object ReviewedDraftPayloadWithNonDiscogsArtistSource(
        Guid trackId,
        string artistName,
        string artistExternalId)
    {
        return new
        {
            title = "Show Me Love",
            type = "single",
            catalogNumber = "ALT 01",
            labelName = (string?)null,
            releaseDate = "1993-01-01",
            year = 1993,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = Array.Empty<string>(),
            artistCredits = new object[]
            {
                new
                {
                    artistId = (Guid?)null,
                    name = artistName,
                    role = "mainArtist",
                    externalSource = ExternalArtistSource(
                        "musicbrainz",
                        "artist",
                        artistExternalId,
                        $"https://musicbrainz.org/artist/{artistExternalId}")
                }
            },
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "Champion", catalogNumber = "ALT 01", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            coverPath = (string?)null,
            externalSources = new[] { DiscogsSource() },
            tracks = new object[]
            {
                new
                {
                    id = trackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Show Me Love",
                    durationSeconds = (int?)300,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }

    private static object ReviewedDraftPayloadWithBlankArtistSource(Guid trackId)
    {
        return new
        {
            title = "Show Me Love",
            type = "single",
            catalogNumber = "SHOW 01",
            labelName = (string?)null,
            releaseDate = "1993-01-01",
            year = 1993,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = Array.Empty<string>(),
            artistCredits = new object[]
            {
                new
                {
                    artistId = (Guid?)null,
                    name = "Robin Stone",
                    role = "mainArtist",
                    externalSource = new
                    {
                        providerName = (string?)null,
                        resourceType = "artist",
                        externalId = " ",
                        sourceUrl = (string?)null
                    }
                }
            },
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "Champion", catalogNumber = "SHOW 01", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            coverPath = (string?)null,
            externalSources = new[] { DiscogsSource() },
            tracks = new object[]
            {
                new
                {
                    id = trackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Show Me Love",
                    durationSeconds = (int?)300,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }

    private static object ArtistSource(string externalId)
    {
        return ExternalArtistSource(
            "discogs",
            "artist",
            externalId,
            $"https://www.discogs.com/artist/{externalId}");
    }

    private static object ExternalArtistSource(
        string providerName,
        string resourceType,
        string externalId,
        string sourceUrl)
    {
        return new
        {
            providerName,
            resourceType,
            externalId,
            sourceUrl
        };
    }
}
