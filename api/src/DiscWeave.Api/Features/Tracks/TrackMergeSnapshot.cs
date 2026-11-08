using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Api.Features.Tracks;

internal static class TrackMergeSnapshot
{
    public static string Create(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        TrackMergeRequest request,
        IReadOnlyList<string> importInputs,
        IReadOnlyList<TrackResponse> records)
    {
        // Hash mapped values, including owned rows, shadow keys and complex values.
        // A new dependency or changed review input therefore invalidates confirmation.
        string[] rows = [.. context.ChangeTracker.Entries().Select(entry => JsonSerializer.Serialize(new
        {
            Type = entry.Metadata.Name,
            Values = Properties(entry.Properties, entry.ComplexProperties).OrderBy(pair => pair.Key, StringComparer.Ordinal)
        })).Order(StringComparer.Ordinal)];
        string snapshot = JsonSerializer.Serialize(new
        {
            Collection = collectionId.Value,
            request.KeeperTrackId,
            Duplicates = request.DuplicateTrackIds.Order(),
            Rows = rows,
            Imports = importInputs,
            Records = records
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(snapshot)));
    }

    private static IEnumerable<KeyValuePair<string, object?>> Properties(
        IEnumerable<PropertyEntry> properties,
        IEnumerable<ComplexPropertyEntry> complexes,
        string prefix = "")
    {
        foreach (PropertyEntry property in properties)
        {
            ValueConverter? converter = property.Metadata.GetTypeMapping().Converter;
            object? value = converter is null ? property.CurrentValue : converter.ConvertToProvider(property.CurrentValue);
            yield return new KeyValuePair<string, object?>(prefix + property.Metadata.Name, value);
        }

        foreach (ComplexPropertyEntry complex in complexes)
        {
            foreach (KeyValuePair<string, object?> value in Properties(complex.Properties, complex.ComplexProperties, prefix + complex.Metadata.Name + "."))
            {
                yield return value;
            }
        }
    }
}
