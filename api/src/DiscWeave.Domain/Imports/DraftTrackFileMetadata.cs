using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Imports;

public sealed record DraftTrackFileMetadata
{
    public static DraftTrackFileMetadata Empty { get; } = new(
        Optional.Missing<string>(),
        Optional.Missing<AudioFileQuality>(),
        Optional.Missing<int>(),
        Optional.Missing<int>(),
        Optional.Missing<int>());

    public DraftTrackFileMetadata(
        IOptionalValue<string> codec,
        IOptionalValue<AudioFileQuality> quality,
        IOptionalValue<int> bitrateKbps,
        IOptionalValue<int> sampleRateHz,
        IOptionalValue<int> channels)
    {
        ArgumentNullException.ThrowIfNull(codec);
        ArgumentNullException.ThrowIfNull(quality);
        ArgumentNullException.ThrowIfNull(bitrateKbps);
        ArgumentNullException.ThrowIfNull(sampleRateHz);
        ArgumentNullException.ThrowIfNull(channels);

        Codec = codec;
        Quality = quality;
        BitrateKbps = bitrateKbps;
        SampleRateHz = sampleRateHz;
        Channels = channels;
    }

    public IOptionalValue<string> Codec { get; }

    public IOptionalValue<AudioFileQuality> Quality { get; }

    public IOptionalValue<int> BitrateKbps { get; }

    public IOptionalValue<int> SampleRateHz { get; }

    public IOptionalValue<int> Channels { get; }
}
