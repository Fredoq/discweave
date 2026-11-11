using System.Globalization;
using System.Text.Json.Serialization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class DiscogsExternalMetadataProvider : IDiscogsLabelCatalogProvider
{
    public async Task<ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>>> SearchLabelsAsync(
        string query, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Length > 200)
        {
            return new(InvalidResponse());
        }

        DiscogsProviderConfiguration configuration = await ValidateConfigurationAsync(cancellationToken);
        if (configuration.Error is not null)
        {
            return new(configuration.Error);
        }

        Dictionary<string, string> parameters = SearchParameters(20, "label");
        parameters["q"] = query.Trim();
        ExternalMetadataResult<DiscogsSearchResponse> response = await SendAsync<DiscogsSearchResponse>(
            "/database/search", parameters, configuration.AccessToken, cancellationToken, maximumResponseBytes: 2 * 1024 * 1024);
        if (!response.IsSuccess)
        {
            return new(response.Error);
        }

        if (response.Value.Results is null || response.Value.Results.Length > 20 ||
            response.Value.Results.Any(item => item is null || item.Id <= 0 || !ValidLabelText(item.Title, 500) || item.Type != "label"))
        {
            return new(InvalidResponse());
        }

        DiscogsLabelCandidate[] items = [.. response.Value.Results.Select(item =>
            new DiscogsLabelCandidate(item.Id.ToString(CultureInfo.InvariantCulture), item.Title ?? string.Empty))];
        return new(new ExternalMetadataSearchResult<DiscogsLabelCandidate>(items, response.Value.Pagination?.Items));
    }

    public async Task<ExternalMetadataResult<DiscogsLabelCandidate>> GetLabelAsync(
        string externalId, CancellationToken cancellationToken)
    {
        if (!ValidLabelId(externalId))
        {
            return new(InvalidResponse());
        }

        DiscogsProviderConfiguration configuration = await ValidateConfigurationAsync(cancellationToken);
        if (configuration.Error is not null)
        {
            return new(configuration.Error);
        }

        ExternalMetadataResult<LabelDetailDto> response = await SendAsync<LabelDetailDto>(
            $"/labels/{externalId}", EmptyParameters, configuration.AccessToken, cancellationToken, maximumResponseBytes: 2 * 1024 * 1024);
        if (!response.IsSuccess)
        {
            return new(response.Error);
        }

        LabelDetailDto value = response.Value;
        return value.Id.ToString(CultureInfo.InvariantCulture) != externalId || value.Name is not { } name || !ValidLabelText(name, 500)
            ? new(InvalidResponse())
            : new(new DiscogsLabelCandidate(externalId, name));
    }

    public async Task<ExternalMetadataResult<DiscogsLabelCatalogPage>> GetLabelReleasesAsync(
        string externalId, int page, CancellationToken cancellationToken)
    {
        if (!ValidLabelId(externalId) || page is < 1 or > 100000)
        {
            return new(InvalidResponse());
        }

        DiscogsProviderConfiguration configuration = await ValidateConfigurationAsync(cancellationToken);
        if (configuration.Error is not null)
        {
            return new(configuration.Error);
        }

        Dictionary<string, string> parameters = new(StringComparer.Ordinal)
        {
            ["page"] = page.ToString(CultureInfo.InvariantCulture),
            ["per_page"] = "100"
        };
        ExternalMetadataResult<LabelReleasesDto> response = await SendAsync<LabelReleasesDto>(
            $"/labels/{externalId}/releases", parameters, configuration.AccessToken, cancellationToken, maximumResponseBytes: 2 * 1024 * 1024);
        if (!response.IsSuccess)
        {
            return new(response.Error);
        }

        LabelReleasesDto value = response.Value;
        if (value.Releases is not { } releases || value.Pagination is not { Items: { } total, Pages: { } pages } || !ValidLabelPage(value, page))
        {
            return new(InvalidResponse());
        }

        DiscogsLabelCatalogItem[] items = [.. releases.Select(item => new DiscogsLabelCatalogItem(
            item.Id.ToString(CultureInfo.InvariantCulture), item.Catno ?? string.Empty, item.Artist ?? string.Empty,
            item.Title ?? string.Empty, item.Year ?? 0, item.Format ?? string.Empty))];
        return new(new DiscogsLabelCatalogPage(items, page, 100, total, pages));
    }

    private static bool ValidLabelId(string value)
    {
        return value is { Length: > 0 and <= 19 } && value.All(char.IsAsciiDigit) &&
            long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0 &&
            value == id.ToString(CultureInfo.InvariantCulture);
    }

    private static bool ValidLabelText(string? value, int maximum)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Length <= maximum;
    }

    private static bool ValidLabelPage(LabelReleasesDto value, int page)
    {
        return value.Pagination is { Items: >= 0, Pages: >= 0, PerPage: 100 } pagination && pagination.Page == page &&
            value.Releases is { Length: <= 100 } releases && releases.Length <= pagination.Items &&
            (pagination.Items == 0 || pagination.Pages >= page) &&
            releases.All(item => item is not null && item.Id > 0 && ValidLabelText(item.Title, 2000) &&
                (item.Catno?.Length ?? 0) <= 500 && (item.Artist?.Length ?? 0) <= 2000 &&
                (item.Format?.Length ?? 0) <= 2000 && (item.Year is null or (>= 0 and <= 9999)));
    }

#pragma warning disable CA1812
    private sealed record LabelDetailDto
    {
        public LabelDetailDto(long id, string? name)
        {
            Id = id;
            Name = name;
        }

        public long Id { get; init; }

        public string? Name { get; init; }
    }

    private sealed record LabelReleasesDto
    {
        public LabelReleasesDto(LabelPaginationDto? pagination, LabelReleaseDto[]? releases)
        {
            Pagination = pagination;
            Releases = releases;
        }

        public LabelPaginationDto? Pagination { get; init; }

        public LabelReleaseDto[]? Releases { get; init; }
    }

    private sealed record LabelPaginationDto
    {
        public LabelPaginationDto(int? page, int? pages, int? items, int? perPage)
        {
            Page = page;
            Pages = pages;
            Items = items;
            PerPage = perPage;
        }

        public int? Page { get; init; }

        public int? Pages { get; init; }

        public int? Items { get; init; }

        [JsonPropertyName("per_page")]
        public int? PerPage { get; init; }
    }

    private sealed record LabelReleaseDto
    {
        public LabelReleaseDto(long id, string? catno, string? artist, string? title, int? year, string? format)
        {
            Id = id;
            Catno = catno;
            Artist = artist;
            Title = title;
            Year = year;
            Format = format;
        }

        public long Id { get; init; }

        public string? Catno { get; init; }

        public string? Artist { get; init; }

        public string? Title { get; init; }

        public int? Year { get; init; }

        public string? Format { get; init; }
    }
#pragma warning restore CA1812
}
