using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Collection;

public sealed class LocalAudioFile : IEntity<LocalAudioFileId>
{
    private string? _importIdentityPath;
    private long? _importIdentitySizeBytes;
    private DateTimeOffset? _importIdentityLastModifiedAt;
    private string? _importIdentityContentHash;

    private LocalAudioFile()
    {
        Path = FilePath.FromAbsolutePath("/");
        Format = Optional.Missing<AudioFileFormat>();
        Codec = Optional.Missing<string>();
        Quality = Optional.Missing<AudioFileQuality>();
        SizeBytes = Optional.Missing<long>();
        ModifiedAt = Optional.Missing<DateTimeOffset>();
        ContentHash = Optional.Missing<string>();
        Duration = Optional.Missing<TimeSpan>();
        BitrateKbps = Optional.Missing<int>();
        SampleRateHz = Optional.Missing<int>();
        Channels = Optional.Missing<int>();
    }

    private LocalAudioFile(CollectionId collectionId, LocalAudioFileId id, FilePath path)
        : this()
    {
        ArgumentNullException.ThrowIfNull(path);

        CollectionId = collectionId;
        Id = id;
        Path = path;
    }

    public CollectionId CollectionId { get; private set; }

    public LocalAudioFileId Id { get; private set; }

    public FilePath Path { get; private set; }

    public IOptionalValue<AudioFileFormat> Format { get; private set; }

    public IOptionalValue<string> Codec { get; private set; }

    public IOptionalValue<AudioFileQuality> Quality { get; private set; }

    public IOptionalValue<long> SizeBytes { get; private set; }

    public IOptionalValue<DateTimeOffset> ModifiedAt { get; private set; }

    public IOptionalValue<string> ContentHash { get; private set; }

    public IOptionalValue<TimeSpan> Duration { get; private set; }

    public IOptionalValue<int> BitrateKbps { get; private set; }

    public IOptionalValue<int> SampleRateHz { get; private set; }

    public IOptionalValue<int> Channels { get; private set; }

    public IOptionalValue<FileImportIdentity> ImportIdentity => CreateImportIdentity();

    public static LocalAudioFile Create(CollectionId collectionId, LocalAudioFileId id, FilePath path)
    {
        return new LocalAudioFile(collectionId, id, path);
    }

    public LocalAudioFile MoveTo(FilePath path)
    {
        ArgumentNullException.ThrowIfNull(path);

        Path = path;
        return this;
    }

    public LocalAudioFile WithFormat(AudioFileFormat format)
    {
        Format = Optional.From(Guard.DefinedEnum(format, nameof(format), "local_audio_file.format_invalid"));
        return this;
    }

    public LocalAudioFile WithCodec(string codec)
    {
        Codec = Optional.From(Guard.RequiredText(codec, nameof(codec), "local_audio_file.codec_required"));
        return this;
    }

    public LocalAudioFile WithQuality(AudioFileQuality quality)
    {
        Quality = Optional.From(Guard.DefinedEnum(quality, nameof(quality), "local_audio_file.quality_invalid"));
        return this;
    }

    public LocalAudioFile WithSizeBytes(long sizeBytes)
    {
        SizeBytes = Optional.From(Guard.Positive(sizeBytes, nameof(sizeBytes), "local_audio_file.size_required"));
        return this;
    }

    public LocalAudioFile WithModifiedAt(DateTimeOffset modifiedAt)
    {
        ModifiedAt = Optional.From(modifiedAt);
        return this;
    }

    public LocalAudioFile WithContentHash(string contentHash)
    {
        ContentHash = Optional.From(Guard.RequiredText(contentHash, nameof(contentHash), "local_audio_file.content_hash_required").ToLowerInvariant());
        return this;
    }

    public LocalAudioFile WithDuration(TimeSpan duration)
    {
        Duration = Optional.From(Guard.Positive(duration, nameof(duration), "local_audio_file.duration_required"));
        return this;
    }

    public LocalAudioFile WithBitrateKbps(int bitrateKbps)
    {
        BitrateKbps = Optional.From(Guard.Positive(bitrateKbps, nameof(bitrateKbps), "local_audio_file.bitrate_required"));
        return this;
    }

    public LocalAudioFile WithSampleRateHz(int sampleRateHz)
    {
        SampleRateHz = Optional.From(Guard.Positive(sampleRateHz, nameof(sampleRateHz), "local_audio_file.sample_rate_required"));
        return this;
    }

    public LocalAudioFile WithChannels(int channels)
    {
        Channels = Optional.From(Guard.Positive(channels, nameof(channels), "local_audio_file.channels_required"));
        return this;
    }

    public LocalAudioFile WithImportIdentity(FileImportIdentity importIdentity)
    {
        ArgumentNullException.ThrowIfNull(importIdentity);

        _importIdentityPath = importIdentity.Path.Value;
        _importIdentitySizeBytes = importIdentity.SizeBytes;
        _importIdentityLastModifiedAt = importIdentity.LastModifiedAt;
        _importIdentityContentHash = importIdentity.ContentHash is PresentOptionalValue<string> presentHash
            ? presentHash.Value
            : null;
        return this;
    }

    private IOptionalValue<FileImportIdentity> CreateImportIdentity()
    {
        if (_importIdentityPath is null &&
            _importIdentitySizeBytes is null &&
            _importIdentityLastModifiedAt is null &&
            _importIdentityContentHash is null)
        {
            return Optional.Missing<FileImportIdentity>();
        }

        if (_importIdentityPath is null || _importIdentitySizeBytes is null || _importIdentityLastModifiedAt is null)
        {
            throw new InvalidOperationException("Local audio file import identity payload is not valid");
        }

        var path = FilePath.FromAbsolutePath(_importIdentityPath);
        FileImportIdentity identity = _importIdentityContentHash is null
            ? FileImportIdentity.Create(path, _importIdentitySizeBytes.Value, _importIdentityLastModifiedAt.Value)
            : FileImportIdentity.Create(path, _importIdentitySizeBytes.Value, _importIdentityLastModifiedAt.Value, _importIdentityContentHash);

        return Optional.From(identity);
    }
}
