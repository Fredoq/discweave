using System.Text.Json.Nodes;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzLineageMappingTests
{
    private static string SingleWorkRecording(string recordingMbid, string title)
    {
        return new JsonObject
        {
            ["id"] = WorkMbid,
            ["title"] = title,
            ["relations"] = new JsonArray
            {
                new JsonObject
                {
                    ["type-id"] = "fdca14be-ae9a-499f-a27f-7f4188c9b0cc",
                    ["type"] = "performance",
                    ["direction"] = "backward",
                    ["target-type"] = "recording",
                    ["recording"] = new JsonObject
                    {
                        ["id"] = recordingMbid,
                        ["title"] = title
                    }
                }
            }
        }.ToJsonString();
    }

    private static string SingleReleaseGroup(string groupMbid, string title)
    {
        return new JsonObject
        {
            ["count"] = 1,
            ["offset"] = 0,
            ["release-groups"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = groupMbid,
                    ["title"] = title,
                    ["score"] = 100,
                    ["first-release-date"] = "1995"
                }
            }
        }.ToJsonString();
    }

    private static string SingleReleasePageWithDisplayMetadata(
        string recordingMbid,
        string releaseMbid,
        string groupMbid,
        string date)
    {
        return new JsonObject
        {
            ["release-count"] = 1,
            ["release-offset"] = 0,
            ["releases"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = releaseMbid,
                    ["title"] = "Earoica / Anomaly Calling Your Name",
                    ["date"] = date,
                    ["artist-credit"] = new JsonArray
                    {
                        new JsonObject { ["name"] = "Selected Artist" }
                    },
                    ["label-info"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["catalog-number"] = "MNR-008",
                            ["label"] = new JsonObject
                            {
                                ["id"] = "88888888-8888-8888-8888-888888888888",
                                ["name"] = "Musicnow Records"
                            }
                        }
                    },
                    ["release-group"] = new JsonObject
                    {
                        ["id"] = groupMbid,
                        ["title"] = "Earoica / Anomaly Calling Your Name"
                    },
                    ["media"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["position"] = 1,
                            ["format"] = "12\" Vinyl",
                            ["tracks"] = new JsonArray
                            {
                                new JsonObject
                                {
                                    ["id"] = "30e61342-fcd7-47ad-a52d-cdafa54d4eab",
                                    ["number"] = "A",
                                    ["position"] = 1,
                                    ["title"] = "Earoica",
                                    ["length"] = 476000,
                                    ["recording"] = new JsonObject
                                    {
                                        ["id"] = OtherOriginalMbid,
                                        ["title"] = "Earoica",
                                        ["artist-credit"] = new JsonArray()
                                    }
                                },
                                new JsonObject
                                {
                                    ["id"] = FirstTrackMbid,
                                    ["number"] = "B",
                                    ["position"] = 2,
                                    ["title"] = "Selected",
                                    ["length"] = 594000,
                                    ["recording"] = new JsonObject
                                    {
                                        ["id"] = recordingMbid,
                                        ["title"] = "Selected",
                                        ["artist-credit"] = new JsonArray()
                                    }
                                }
                            }
                        }
                    },
                    ["relations"] = new JsonArray()
                }
            }
        }.ToJsonString();
    }
}
