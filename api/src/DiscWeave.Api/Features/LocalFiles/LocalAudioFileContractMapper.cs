using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.LocalFiles;

internal static class LocalAudioFileContractMapper
{
    public static LocalAudioFileResponse ToResponse(LocalAudioFile file)
    {
        LocalAudioFileFields fields = ToFields(file);

        return new LocalAudioFileResponse(
            fields.Id,
            fields.Path,
            fields.Format,
            fields.Codec,
            fields.Quality,
            fields.SizeBytes,
            fields.ModifiedAt,
            fields.ContentHash,
            fields.DurationSeconds,
            fields.BitrateKbps,
            fields.SampleRateHz,
            fields.Channels);
    }

    public static LocalAudioFileFields ToFields(LocalAudioFile file)
    {
        return new LocalAudioFileFields(
            file.Id.Value,
            file.Path.Value,
            OptionalAudioFormat(file.Format),
            OptionalString(file.Codec),
            OptionalAudioQuality(file.Quality),
            OptionalLong(file.SizeBytes),
            OptionalDateTimeOffset(file.ModifiedAt),
            OptionalString(file.ContentHash),
            OptionalDurationSeconds(file.Duration),
            OptionalInt(file.BitrateKbps),
            OptionalInt(file.SampleRateHz),
            OptionalInt(file.Channels));
    }

    public static void ApplyUpdate(LocalAudioFile file, UpdateLocalAudioFileRequest request)
    {
        if (request.Path is not null)
        {
            _ = file.MoveTo(FilePath.FromAbsolutePath(request.Path));
        }

        if (request.Format is not null)
        {
            _ = file.WithFormat(ParseAudioFileFormat(request.Format));
        }

        if (request.Codec is not null)
        {
            _ = file.WithCodec(request.Codec);
        }

        if (request.Quality is not null)
        {
            _ = file.WithQuality(ParseAudioFileQuality(request.Quality));
        }

        if (request.SizeBytes is not null)
        {
            _ = file.WithSizeBytes(request.SizeBytes.Value);
        }

        if (request.LastModifiedAt is not null)
        {
            _ = file.WithModifiedAt(request.LastModifiedAt.Value);
        }

        if (request.ContentHash is not null)
        {
            _ = file.WithContentHash(request.ContentHash);
        }

        if (request.DurationSeconds is not null)
        {
            _ = file.WithDuration(TimeSpan.FromSeconds(request.DurationSeconds.Value));
        }

        if (request.BitrateKbps is not null)
        {
            _ = file.WithBitrateKbps(request.BitrateKbps.Value);
        }

        if (request.SampleRateHz is not null)
        {
            _ = file.WithSampleRateHz(request.SampleRateHz.Value);
        }

        if (request.Channels is not null)
        {
            _ = file.WithChannels(request.Channels.Value);
        }
    }

    private static AudioFileFormat ParseAudioFileFormat(string format)
    {
        return format.Trim().ToLowerInvariant() switch
        {
            "flac" => AudioFileFormat.Flac,
            "mp3" => AudioFileFormat.Mp3,
            "ogg" => AudioFileFormat.Ogg,
            "wav" => AudioFileFormat.Wav,
            "aiff" => AudioFileFormat.Aiff,
            "alac" => AudioFileFormat.Alac,
            "m4a" => AudioFileFormat.M4a,
            _ => throw new DomainException("local_audio_file.format_invalid", "Audio file format is invalid")
        };
    }

    private static AudioFileQuality ParseAudioFileQuality(string quality)
    {
        return quality.Trim().ToLowerInvariant() switch
        {
            "lossless" => AudioFileQuality.Lossless,
            "lossy" => AudioFileQuality.Lossy,
            _ => throw new DomainException("local_audio_file.quality_invalid", "Audio file quality is invalid")
        };
    }

    private static string? OptionalString(IOptionalValue<string>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => string.Empty) : null;
    }

    private static long? OptionalLong(IOptionalValue<long>? value)
    {
        return value is PresentOptionalValue<long> present ? present.Value : null;
    }

    private static int? OptionalInt(IOptionalValue<int>? value)
    {
        return value is PresentOptionalValue<int> present ? present.Value : null;
    }

    private static DateTimeOffset? OptionalDateTimeOffset(IOptionalValue<DateTimeOffset>? value)
    {
        return value is PresentOptionalValue<DateTimeOffset> present ? present.Value : null;
    }

    private static int? OptionalDurationSeconds(IOptionalValue<TimeSpan>? value)
    {
        return value is PresentOptionalValue<TimeSpan> present ? (int)present.Value.TotalSeconds : null;
    }

    private static string? OptionalAudioFormat(IOptionalValue<AudioFileFormat>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileFormatCode, () => string.Empty) : null;
    }

    private static string? OptionalAudioQuality(IOptionalValue<AudioFileQuality>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileQualityCode, () => string.Empty) : null;
    }

    private static string ToAudioFileFormatCode(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac => "flac",
            AudioFileFormat.Mp3 => "mp3",
            AudioFileFormat.Ogg => "ogg",
            AudioFileFormat.Wav => "wav",
            AudioFileFormat.Aiff => "aiff",
            AudioFileFormat.Alac => "alac",
            AudioFileFormat.M4a => "m4a",
            _ => throw new InvalidOperationException("Audio file format is not supported")
        };
    }

    private static string ToAudioFileQualityCode(AudioFileQuality quality)
    {
        return quality switch
        {
            AudioFileQuality.Lossless => "lossless",
            AudioFileQuality.Lossy => "lossy",
            _ => throw new InvalidOperationException("Audio file quality is not supported")
        };
    }
}
