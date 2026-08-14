using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using System.Text.Json;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal static partial class PersistenceValueConverters
{
    private static ValueComparer<TModel> OptionalComparer<TModel, TProvider>(
        Func<TModel, TProvider> convert,
        Func<TProvider, TModel> convertBack)
        where TModel : notnull
    {
        return new ValueComparer<TModel>(
            (left, right) => OptionalComparerEquals(left, right, convert),
            value => OptionalHash(convert(value)),
            value => convertBack(convert(value)));
    }

    private static bool OptionalComparerEquals<TModel, TProvider>(
        TModel? left,
        TModel? right,
        Func<TModel, TProvider> convert)
        where TModel : notnull
    {
        return left is null || right is null
            ? left is null && right is null
            : EqualityComparer<TProvider>.Default.Equals(convert(left), convert(right));
    }

    private static IOptionalValue<CoverImage> OptionalCoverImageValue(string? value)
    {
        if (value is null)
        {
            return Optional.Missing<CoverImage>();
        }

        CoverImageStorageModel? model = JsonSerializer.Deserialize<CoverImageStorageModel>(value, CoverImageJsonOptions);
        return model is null
            ? Optional.Missing<CoverImage>()
            : Optional.From(CoverImage.FromStoredMetadata(
                model.StorageKey,
                model.ContentType,
                model.OriginalFileName,
                model.SizeBytes,
                model.SourceType));
    }

    private static string CoverImageToMetadataJson(CoverImage coverImage)
    {
        return JsonSerializer.Serialize(
            new CoverImageStorageModel(
                coverImage.StorageKey,
                coverImage.ContentType,
                coverImage.OriginalFileName,
                coverImage.SizeBytes,
                coverImage.SourceType),
            CoverImageJsonOptions);
    }

    private static int OptionalHash<TProvider>(TProvider value)
    {
        return value is null ? 0 : EqualityComparer<TProvider>.Default.GetHashCode(value);
    }

    private static TValue? OptionalStructValue<TOptional, TValue>(
        IOptionalValue<TOptional> optionalValue,
        Func<TOptional, TValue> selector)
        where TOptional : notnull
        where TValue : struct
    {
        return optionalValue is PresentOptionalValue<TOptional> present
            ? selector(present.Value)
            : null;
    }

    private static IOptionalValue<string> OptionalStringValue(string? value)
    {
        return value is null ? Optional.Missing<string>() : Optional.From(value);
    }

    private static string? OptionalStringValue<TOptional>(
        IOptionalValue<TOptional> optionalValue,
        Func<TOptional, string> selector)
        where TOptional : notnull
    {
        return optionalValue is PresentOptionalValue<TOptional> present
            ? selector(present.Value)
            : null;
    }

    private static readonly JsonSerializerOptions CoverImageJsonOptions = new(JsonSerializerDefaults.Web);

    private sealed record CoverImageStorageModel(
        string StorageKey,
        string ContentType,
        string OriginalFileName,
        long SizeBytes,
        string SourceType);
}
