namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseDateApplyRequest
{
    public ReleaseDateApplyRequest(string token, bool confirmed = false)
    {
        Token = token;
        Confirmed = confirmed;
    }

    public string Token { get; }

    public bool Confirmed { get; }
}
