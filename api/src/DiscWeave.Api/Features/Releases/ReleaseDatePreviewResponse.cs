using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseDatePreviewResponse
{
    public ReleaseDatePreviewResponse(
        string? token,
        ReleaseResponse current,
        ExternalMetadataReleaseDetail detail,
        object? date)
    {
        Token = token;
        CurrentYear = current.Year;
        CurrentDate = current.ReleaseDate;
        CurrentTitle = current.Title;
        CurrentArtists = [.. current.ArtistCredits.Select(credit => credit.ArtistName)];
        CurrentCatalogNumbers = [.. current.Labels.Select(label => label.CatalogNumber).OfType<string>()];
        CurrentLabels = [.. current.Labels.Select(label => label.Name)];
        Source = detail.Source;
        Title = detail.Title;
        Artists = detail.Artists;
        CatalogNumber = detail.CatalogNumber;
        Labels = detail.Labels;
        Formats = detail.Formats;
        Date = date;
    }

    public string? Token { get; }

    public int? CurrentYear { get; }

    public string? CurrentDate { get; }

    public string CurrentTitle { get; }

    public IReadOnlyList<string> CurrentArtists { get; }

    public IReadOnlyList<string> CurrentCatalogNumbers { get; }

    public IReadOnlyList<string> CurrentLabels { get; }

    public ExternalMetadataSource Source { get; }

    public string Title { get; }

    public IReadOnlyList<string> Artists { get; }

    public string? CatalogNumber { get; }

    public IReadOnlyList<string> Labels { get; }

    public IReadOnlyList<string> Formats { get; }

    public object? Date { get; }
}
