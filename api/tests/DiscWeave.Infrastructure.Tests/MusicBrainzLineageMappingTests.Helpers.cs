using System.Net;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json.Nodes;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    private const string SelectedRemixMbid = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    private const string SelectedEditMbid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    private const string OriginalMbid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string OtherOriginalMbid = "99999999-9999-9999-9999-999999999999";
    private const string ThirdOriginalMbid = "88888888-8888-8888-8888-888888888888";
    private const string SearchFirstMbid = "11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string SearchSecondMbid = "22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    private const string SearchThirdMbid = "33333333-cccc-cccc-cccc-cccccccccccc";
    private const string WorkMbid = "33333333-3333-3333-3333-333333333333";
    private const string FirstReleaseMbid = "10000000-0000-0000-0000-000000000001";
    private const string SecondReleaseMbid = "10000000-0000-0000-0000-000000000002";
    private const string ForwardGroupMbid = "20000000-0000-0000-0000-000000000001";
    private const string ReverseGroupMbid = "20000000-0000-0000-0000-000000000002";
    private const string FirstTrackMbid = "30000000-0000-0000-0000-000000000001";

    private static RecordingLineageQuery KnownQuery(string mbid)
    {
        return new RecordingLineageQuery
        {
            Title = "Selected",
            Artists = ["Selected Artist"],
            KnownRecording = Source("recording", mbid)
        };
    }

    private static RecordingLineageQuery SearchQuery()
    {
        return new RecordingLineageQuery
        {
            Title = "Selected",
            Artists = ["Selected Artist"]
        };
    }

    private static ExternalMetadataSource Source(string resourceType, string mbid)
    {
        return new ExternalMetadataSource(
            "musicbrainz",
            resourceType,
            mbid,
            $"https://musicbrainz.org/{resourceType}/{mbid}",
            "Data provided by MusicBrainz.");
    }

    private static MusicBrainzOptions ValidOptions(
        int maxRequestsPerOperation = 40,
        int maxLineageCandidates = 5,
        int maxReleasePages = 5,
        int maxReleaseGroupLookups = 10,
        int operationTimeoutSeconds = 60)
    {
        return new MusicBrainzOptions
        {
            Enabled = true,
            BaseUrl = "https://musicbrainz.org",
            ApplicationName = "DiscWeave",
            ApplicationVersion = "1.0.0",
            Contact = "https://github.com/Fredoq/discweave",
            TimeoutSeconds = 15,
            OperationTimeoutSeconds = operationTimeoutSeconds,
            MinimumRequestIntervalMilliseconds = 1000,
            MaxRetries = 0,
            MaxRetryAfterSeconds = 10,
            MaxRequestsPerOperation = maxRequestsPerOperation,
            MaxRecordingCandidates = 5,
            MaxLineageCandidates = maxLineageCandidates,
            MaxReleasePagesPerRecording = maxReleasePages,
            MaxReleaseGroupLookups = maxReleaseGroupLookups
        };
    }

    private static string ReadFixture(string name, [CallerFilePath] string sourceFile = "")
    {
        string directory = Path.GetDirectoryName(sourceFile)!;
        return File.ReadAllText(Path.Combine(directory, "Fixtures", "MusicBrainz", name));
    }

    private static Task<HttpResponseMessage> JsonResponse(
        string content,
        HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        return Task.FromResult(new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(content, Encoding.UTF8, "application/json")
        });
    }

    private static string RecordingDetail(
        string mbid,
        string title,
        JsonNode[] relations)
    {
        return new JsonObject
        {
            ["id"] = mbid,
            ["title"] = title,
            ["length"] = 180000,
            ["artist-credit"] = new JsonArray
            {
                new JsonObject
                {
                    ["name"] = $"{title} Artist",
                    ["artist"] = new JsonObject
                    {
                        ["id"] = "77777777-7777-7777-7777-777777777777",
                        ["name"] = $"{title} Artist"
                    }
                }
            },
            ["relations"] = new JsonArray(relations)
        }.ToJsonString();
    }

    private static JsonObject RecordingRelation(
        string kind,
        string direction,
        string targetMbid)
    {
        string typeId = kind == "remix"
            ? "bfbdb55a-b857-473a-8f2e-a9c09e45c3f5"
            : "ce01b3ac-dd47-4702-9302-085344f96e84";
        return new JsonObject
        {
            ["type-id"] = typeId,
            ["type"] = kind,
            ["direction"] = direction,
            ["target-type"] = "recording",
            ["attributes"] = new JsonArray(),
            ["recording"] = new JsonObject
            {
                ["id"] = targetMbid,
                ["title"] = "Target"
            }
        };
    }

    private static JsonObject WorkRelation(string workMbid)
    {
        return new JsonObject
        {
            ["type-id"] = "fdca14be-ae9a-499f-a27f-7f4188c9b0cc",
            ["type"] = "performance",
            ["direction"] = "backward",
            ["target-type"] = "work",
            ["attributes"] = new JsonArray(),
            ["work"] = new JsonObject
            {
                ["id"] = workMbid,
                ["title"] = "Work"
            }
        };
    }

    private static string SearchResponse(params (string Mbid, int Score, string Title)[] hits)
    {
        var recordings = new JsonArray();
        foreach ((string mbid, int score, string title) in hits)
        {
            recordings.Add(new JsonObject
            {
                ["id"] = mbid,
                ["score"] = score,
                ["title"] = title,
                ["length"] = 180000,
                ["artist-credit"] = new JsonArray()
            });
        }

        return new JsonObject
        {
            ["count"] = hits.Length,
            ["offset"] = 0,
            ["recordings"] = recordings
        }.ToJsonString();
    }

    private static string EmptyReleasePage()
    {
        return new JsonObject
        {
            ["release-count"] = 0,
            ["release-offset"] = 0,
            ["releases"] = new JsonArray()
        }.ToJsonString();
    }

    private static string SingleReleasePage(
        string recordingMbid,
        string releaseMbid,
        string groupMbid,
        string date,
        bool includeInvalidRow = false,
        bool includeDiscogsRelation = false,
        int reportedTotal = 1)
    {
        var tracks = new JsonArray
        {
            Track(FirstTrackMbid, recordingMbid, "Original")
        };
        if (includeInvalidRow)
        {
            tracks.Add(new JsonObject
            {
                ["id"] = "not-an-mbid",
                ["number"] = "2",
                ["recording"] = new JsonObject { ["id"] = recordingMbid }
            });
        }

        var relations = new JsonArray();
        if (includeDiscogsRelation)
        {
            relations.Add(new JsonObject
            {
                ["type-id"] = "4a78823c-1c53-4176-a5f3-58026c76f2bc",
                ["target-type"] = "url",
                ["url"] = new JsonObject { ["resource"] = "https://www.discogs.com/release/12345-example" }
            });
        }

        return new JsonObject
        {
            ["release-count"] = reportedTotal,
            ["release-offset"] = 0,
            ["releases"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = releaseMbid,
                    ["title"] = "Release",
                    ["date"] = date,
                    ["release-group"] = new JsonObject
                    {
                        ["id"] = groupMbid,
                        ["title"] = "Group"
                    },
                    ["media"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["position"] = 1,
                            ["tracks"] = tracks
                        }
                    },
                    ["relations"] = relations
                }
            }
        }.ToJsonString();
    }

    private static JsonObject Track(string trackMbid, string recordingMbid, string title)
    {
        return new JsonObject
        {
            ["id"] = trackMbid,
            ["number"] = "A1",
            ["position"] = 1,
            ["title"] = title,
            ["recording"] = new JsonObject
            {
                ["id"] = recordingMbid,
                ["title"] = title,
                ["artist-credit"] = new JsonArray()
            }
        };
    }
}
