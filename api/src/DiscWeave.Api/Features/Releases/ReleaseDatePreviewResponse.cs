using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Releases;

public sealed record ReleaseDatePreviewResponse
{
    public ReleaseDatePreviewResponse(
        string? token,
        int? currentYear,
        string? currentDate,
        string currentTitle,
        IReadOnlyList<string> currentArtists,
        IReadOnlyList<string> currentCatalogNumbers,
        IReadOnlyList<string> currentLabels,
        ExternalMetadataSource source,
        string title,
        IReadOnlyList<string> artists,
        string? catalogNumber,
        IReadOnlyList<string> labels,
        IReadOnlyList<string> formats,
        object? date)
    {
        Token = token;
        CurrentYear = currentYear;
        CurrentDate = currentDate;
        CurrentTitle = currentTitle;
        CurrentArtists = currentArtists;
        CurrentCatalogNumbers = currentCatalogNumbers;
        CurrentLabels = currentLabels;
        Source = source;
        Title = title;
        Artists = artists;
        CatalogNumber = catalogNumber;
        Labels = labels;
        Formats = formats;
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
