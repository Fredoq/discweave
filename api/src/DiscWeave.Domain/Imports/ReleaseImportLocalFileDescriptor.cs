using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportLocalFileDescriptor
{
    private ReleaseImportLocalFileDescriptor()
    {
    }

    public string FilePath { get; private init; } = string.Empty;

    public string RelativePath { get; private init; } = string.Empty;

    public AudioFileFormat Format { get; private init; }

    public long SizeBytes { get; private init; }

    public DateTimeOffset LastModifiedAt { get; private init; }

    public IOptionalValue<string> ContentHash { get; private init; } = Optional.Missing<string>();

    public IOptionalValue<string> Codec { get; private init; } = Optional.Missing<string>();

    public IOptionalValue<AudioFileQuality> Quality { get; private init; } = Optional.Missing<AudioFileQuality>();

    public IOptionalValue<int> BitrateKbps { get; private init; } = Optional.Missing<int>();

    public IOptionalValue<int> SampleRateHz { get; private init; } = Optional.Missing<int>();

    public IOptionalValue<int> Channels { get; private init; } = Optional.Missing<int>();

    public static ReleaseImportLocalFileDescriptor Create(DraftTrackFileInfo file)
    {
        ArgumentNullException.ThrowIfNull(file);

        return new ReleaseImportLocalFileDescriptor
        {
            FilePath = Guard.RequiredText(file.FilePath, nameof(file.FilePath), "release_import.track_file_required"),
            RelativePath = Guard.RequiredText(file.RelativePath, nameof(file.RelativePath), "release_import.track_relative_path_required"),
            Format = file.Format,
            SizeBytes = Guard.Positive(file.SizeBytes, nameof(file.SizeBytes), "release_import.track_size_invalid"),
            LastModifiedAt = file.LastModifiedAt,
            ContentHash = NormalizeOptionalText(file.ContentHash, normalizeCase: true),
            Codec = NormalizeOptionalText(file.Metadata.Codec, normalizeCase: false),
            Quality = NormalizeQuality(file.Metadata.Quality),
            BitrateKbps = NormalizePositive(file.Metadata.BitrateKbps, nameof(file.Metadata.BitrateKbps), "release_import.track_bitrate_invalid"),
            SampleRateHz = NormalizePositive(file.Metadata.SampleRateHz, nameof(file.Metadata.SampleRateHz), "release_import.track_sample_rate_invalid"),
            Channels = NormalizePositive(file.Metadata.Channels, nameof(file.Metadata.Channels), "release_import.track_channels_invalid")
        };
    }

    private static IOptionalValue<string> NormalizeOptionalText(IOptionalValue<string> value, bool normalizeCase)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (value is not PresentOptionalValue<string> present || string.IsNullOrWhiteSpace(present.Value))
        {
            return Optional.Missing<string>();
        }

        string normalized = present.Value.Trim();
        return Optional.From(normalizeCase ? normalized.ToLowerInvariant() : normalized);
    }

    private static IOptionalValue<AudioFileQuality> NormalizeQuality(IOptionalValue<AudioFileQuality> value)
    {
        ArgumentNullException.ThrowIfNull(value);

        return value is PresentOptionalValue<AudioFileQuality> present
            ? Optional.From(Guard.DefinedEnum(present.Value, nameof(value), "release_import.track_quality_invalid"))
            : Optional.Missing<AudioFileQuality>();
    }

    private static IOptionalValue<int> NormalizePositive(IOptionalValue<int> value, string fieldName, string code)
    {
        ArgumentNullException.ThrowIfNull(value);

        return value is PresentOptionalValue<int> present
            ? Optional.From(Guard.Positive(present.Value, fieldName, code))
            : Optional.Missing<int>();
    }
}
