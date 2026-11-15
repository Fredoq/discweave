namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal interface IMusicBrainzRequestGate
{
    Task<HttpResponseMessage> SendAsync(Func<CancellationToken, Task<HttpResponseMessage>> send, CancellationToken cancellationToken);

    void Defer(TimeSpan retryAfter);
}
