using System.Text.Json;
using System.Text.Json.Nodes;

namespace DiscWeave.Infrastructure.LocalDesktop;

/// <summary>One explicitly supported archive layout produced by the former compatibility upgrades.</summary>
internal static class ArchiveHistoricalBaseline
{
    public static Dictionary<string, string> Create(Dictionary<string, string> current)
    {
        var historical = new Dictionary<string, string>(current, StringComparer.Ordinal);
        ReplaceDefaults(historical, "rating_criteria", new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["artist_average_roles"] = "'mainArtist\nremixer'",
        });
        ReplaceDefaults(historical, "release_import_draft_tracks", new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["external_sources_json"] = "'[]'",
            ["has_explicit_version_year"] = "0",
            ["is_original"] = "0",
        });
        ReplaceDefaults(historical, "release_import_drafts", new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["binding_promote_linked_target_confirmed"] = "0",
            ["external_review_revision"] = "0",
            ["is_selected_original_binding_valid"] = "0",
        });
        ReplaceOrigins(historical, "release_import_sessions", [
            ["release_import_session_id"],
            ["collection_id", "release_import_session_id"],
            ["collection_id", "release_import_session_id", "source_kind"],
        ]);
        ReplaceOrigins(historical, "release_import_drafts", [
            ["release_import_draft_id"],
            ["collection_id", "release_import_draft_id"],
            ["collection_id", "release_import_draft_id", "source_kind"],
            ["collection_id", "release_import_session_id", "release_import_draft_id"],
        ]);
        ReplaceOrigins(historical, "release_import_draft_tracks", [
            ["release_import_draft_track_id"],
            ["collection_id", "release_import_draft_track_id"],
            ["collection_id", "release_import_draft_id", "release_import_draft_track_id"],
        ]);
        ReplaceOrigins(historical, "release_import_relation_suggestions", [
            ["release_import_relation_suggestion_id"],
            ["collection_id", "release_import_relation_suggestion_id"],
        ]);
        return historical;
    }

    private static void ReplaceDefaults(Dictionary<string, string> schema, string table, Dictionary<string, string> defaults)
    {
        JsonObject definition = JsonNode.Parse(schema[table])!.AsObject();
        foreach (JsonNode? column in definition["Columns"]!.AsArray())
        {
            if (defaults.TryGetValue(column![0]!.GetValue<string>(), out string? value))
            {
                column[3] = value;
            }
        }

        schema[table] = definition.ToJsonString();
    }

    private static void ReplaceOrigins(Dictionary<string, string> schema, string table, string[][] keys)
    {
        JsonObject definition = JsonNode.Parse(schema[table])!.AsObject();
        var indexes = new List<string>();
        foreach (JsonNode? entry in definition["Indexes"]!.AsArray())
        {
            JsonObject index = JsonNode.Parse(entry!.GetValue<string>())!.AsObject();
            string[] fields = [.. index["Fields"]!.AsArray()
                .Where(field => field![4]!.GetValue<string>() == "1")
                .Select(field => field![1]!.GetValue<string>())];
            if (index["Origin"]!.GetValue<string>() == "u" &&
                keys.Any(key => key.SequenceEqual(fields, StringComparer.Ordinal)))
            {
                index["Origin"] = "c";
            }

            indexes.Add(index.ToJsonString());
        }

        definition["Indexes"] = JsonSerializer.SerializeToNode(indexes.Order(StringComparer.Ordinal));
        schema[table] = definition.ToJsonString();
    }
}
