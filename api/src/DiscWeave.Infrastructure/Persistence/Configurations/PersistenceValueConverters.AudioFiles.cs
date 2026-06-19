using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal static partial class PersistenceValueConverters
{
    public static readonly ValueConverter<IOptionalValue<AudioFileFormat>, string?> OptionalAudioFileFormat = new(
        value => OptionalStringValue(value, format => format.ToString()),
        value => value == null ? Optional.Missing<AudioFileFormat>() : Optional.From(Enum.Parse<AudioFileFormat>(value)));

    public static readonly ValueComparer<IOptionalValue<AudioFileFormat>> OptionalAudioFileFormatComparer = OptionalComparer<IOptionalValue<AudioFileFormat>, string?>(
        value => OptionalStringValue(value, format => format.ToString()),
        value => value is null ? Optional.Missing<AudioFileFormat>() : Optional.From(Enum.Parse<AudioFileFormat>(value)));

    public static readonly ValueConverter<IOptionalValue<AudioFileQuality>, string?> OptionalAudioFileQuality = new(
        value => OptionalStringValue(value, quality => quality.ToString()),
        value => value == null ? Optional.Missing<AudioFileQuality>() : Optional.From(Enum.Parse<AudioFileQuality>(value)));

    public static readonly ValueComparer<IOptionalValue<AudioFileQuality>> OptionalAudioFileQualityComparer = OptionalComparer<IOptionalValue<AudioFileQuality>, string?>(
        value => OptionalStringValue(value, quality => quality.ToString()),
        value => value is null ? Optional.Missing<AudioFileQuality>() : Optional.From(Enum.Parse<AudioFileQuality>(value)));
}
