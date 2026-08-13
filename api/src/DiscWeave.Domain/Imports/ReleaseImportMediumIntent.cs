using System.Globalization;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;
using CollectionCompactDisc = DiscWeave.Domain.Collection.CompactDisc;

namespace DiscWeave.Domain.Imports;

public abstract class ReleaseImportMediumIntent
{
    private ReleaseImportMediumIntent()
    {
    }

    public abstract string CanonicalKey { get; }

    public bool Matches(IMedium medium)
    {
        ArgumentNullException.ThrowIfNull(medium);
        string currentKey = medium switch
        {
            DigitalFile => "digital",
            VinylRecord vinyl => $"vinyl:{vinyl.FormatDescription}",
            CollectionCompactDisc compactDisc =>
                $"cd:{compactDisc.DiscCount.ToString(CultureInfo.InvariantCulture)}",
            CassetteTape cassette => $"cassette:{cassette.TapeType}",
            OtherMedium other => $"other:{other.Name}",
            _ => string.Empty
        };
        return string.Equals(CanonicalKey, currentKey, StringComparison.Ordinal);
    }

    public sealed class Digital : ReleaseImportMediumIntent
    {
        private Digital()
        {
        }

        public override string CanonicalKey => "digital";

        public static Digital Create()
        {
            return new Digital();
        }
    }

    public sealed class Vinyl : ReleaseImportMediumIntent
    {
        private Vinyl(string formatDescription)
        {
            FormatDescription = formatDescription;
        }

        public string FormatDescription { get; }

        public override string CanonicalKey => $"vinyl:{FormatDescription}";

        public static Vinyl Create(string formatDescription)
        {
            return new Vinyl(Guard.RequiredText(
                formatDescription,
                nameof(formatDescription),
                "release_import.medium_vinyl_format_required"));
        }
    }

    public sealed class CompactDisc : ReleaseImportMediumIntent
    {
        private CompactDisc(int discCount)
        {
            DiscCount = discCount;
        }

        public int DiscCount { get; }

        public override string CanonicalKey => $"cd:{DiscCount.ToString(CultureInfo.InvariantCulture)}";

        public static CompactDisc Create(int discCount)
        {
            return new CompactDisc(discCount > 0
                ? discCount
                : throw new DomainException(
                    "release_import.medium_disc_count_required",
                    "Compact disc count must be positive"));
        }
    }

    public sealed class Cassette : ReleaseImportMediumIntent
    {
        private Cassette(string tapeType)
        {
            TapeType = tapeType;
        }

        public string TapeType { get; }

        public override string CanonicalKey => $"cassette:{TapeType}";

        public static Cassette Create(string tapeType)
        {
            return new Cassette(Guard.RequiredText(
                tapeType,
                nameof(tapeType),
                "release_import.medium_cassette_type_required"));
        }
    }

    public sealed class Other : ReleaseImportMediumIntent
    {
        private Other(string name)
        {
            Name = name;
        }

        public string Name { get; }

        public override string CanonicalKey => $"other:{Name}";

        public static Other Create(string name)
        {
            return new Other(Guard.RequiredText(
                name,
                nameof(name),
                "release_import.medium_other_name_required"));
        }
    }
}
