namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal interface IMusicBrainzRequestGate
{
    ValueTask WaitAsync(CancellationToken cancellationToken);

    void Defer(TimeSpan retryAfter);
}
