using System.Text.Json;
using System.Text.Json.Serialization;

namespace DiscWeave.Domain.Imports;

internal static class ImportJson
{
    private static readonly JsonSerializerOptions Options = CreateOptions();

    public static string Serialize<T>(IReadOnlyList<T>? values)
    {
        return JsonSerializer.Serialize(values ?? [], Options);
    }

    public static IReadOnlyList<T> Deserialize<T>(string? json)
    {
        return string.IsNullOrWhiteSpace(json)
            ? []
            : JsonSerializer.Deserialize<IReadOnlyList<T>>(json, Options) ?? [];
    }

    public static string SerializeValue<T>(T value)
        where T : notnull
    {
        return JsonSerializer.Serialize(value, Options);
    }

    public static T DeserializeValue<T>(string? json)
        where T : notnull
    {
        return string.IsNullOrWhiteSpace(json)
            ? throw new InvalidOperationException($"{typeof(T).Name} JSON is required.")
            : JsonSerializer.Deserialize<T>(json, Options) ?? throw new InvalidOperationException($"{typeof(T).Name} JSON is invalid.");
    }

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter<ImportReviewSeverity>(JsonNamingPolicy.CamelCase));
        options.Converters.Add(new JsonStringEnumConverter<ReleaseImportRelationSuggestionEndpointKind>(JsonNamingPolicy.CamelCase));
        return options;
    }
}
