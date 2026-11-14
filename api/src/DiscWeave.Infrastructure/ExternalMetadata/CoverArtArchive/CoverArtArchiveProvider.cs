using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

public sealed partial class CoverArtArchiveProvider : IExternalCoverArtworkProvider
{
    private readonly HttpClient _client;
    private readonly MusicBrainzOptions _options;
    private readonly MusicBrainzRequestGate _gate;
    private readonly TimeProvider _time;

    public CoverArtArchiveProvider(HttpClient client, IOptions<MusicBrainzOptions> options, MusicBrainzRequestGate gate, TimeProvider time)
    {
        _client = client;
        _options = options.Value;
        _gate = gate;
        _time = time;
    }

    public Task<IReadOnlyList<CoverReleaseCandidate>> SearchReleasesAsync(CoverReleaseSearchQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);
        return ExecuteAsync<IReadOnlyList<CoverReleaseCandidate>>(async token =>
        {
            var terms = new List<string>();
            AddTerm(terms, "artist", query.Artist);
            AddTerm(terms, "release", query.Title);
            AddTerm(terms, "catno", query.CatalogNumber);
            AddTerm(terms, "barcode", query.Barcode);
            if (terms.Count == 0)
            {
                throw Error("invalid_query", "At least one search field is required");
            }
            string search = string.Join(" AND ", terms);

            using JsonDocument document = await ReadJsonAsync(new Uri($"https://musicbrainz.org/ws/2/release/?query={Uri.EscapeDataString(search)}&fmt=json&limit=20"), token).ConfigureAwait(false);
            JsonElement releases = RequiredArray(document.RootElement, "releases");
            var result = new List<CoverReleaseCandidate>();
            foreach (JsonElement release in releases.EnumerateArray().Take(20))
            {
                if (!Guid.TryParse(Text(release, "id"), out Guid id) || id == Guid.Empty)
                {
                    throw Error("invalid_response", "The artwork provider returned an invalid release");
                }
                string releaseTitle = Text(release, "title") ?? throw Error("invalid_response", "The artwork provider returned an invalid release");
                string[] artists = [.. Items(release, "artist-credit").Select(credit => Text(credit, "name") ?? NestedText(credit, "artist", "name")).OfType<string>()];
                JsonElement[] labels = [.. Items(release, "label-info")];
                result.Add(new CoverReleaseCandidate(id, releaseTitle, artists, Text(release, "date"), Text(release, "country"),
                    [.. Items(release, "media").Select(media => Text(media, "format")).OfType<string>().Distinct()],
                    [.. labels.Select(label => NestedText(label, "label", "name")).OfType<string>().Distinct()],
                    [.. labels.Select(label => Text(label, "catalog-number")).OfType<string>().Distinct()],
                    Text(release, "barcode"), $"https://musicbrainz.org/release/{id:D}"));
            }
            return result;
        }, cancellationToken);
    }

    public Task<IReadOnlyList<CoverArtworkCandidate>> GetFrontCoversAsync(Guid releaseId, CancellationToken cancellationToken)
    {
        return ExecuteAsync<IReadOnlyList<CoverArtworkCandidate>>(async token =>
        {
            ValidateRelease(releaseId);
            JsonDocument document;
            try
            {
                document = await LoadArtworkAsync(releaseId, token).ConfigureAwait(false);
            }
            catch (DomainException exception) when (exception.Code == "external_cover.not_found")
            {
                return [];
            }
            using JsonDocument ownedDocument = document;
            return [.. FrontImages(document.RootElement).Select(image => new CoverArtworkCandidate(
                ImageId(image), Text(image, "comment"), IsTrue(image, "approved"),
                [.. Items(image, "types").Select(type => type.GetString()).OfType<string>()], Source(releaseId)))];
        }, cancellationToken);
    }

    public Task<DownloadedCoverArtwork> DownloadFrontCoverAsync(Guid releaseId, string imageId, bool preview, CancellationToken cancellationToken)
    {
        return ExecuteAsync(async token =>
        {
            ValidateRelease(releaseId);
            ValidateImageId(imageId);
            using JsonDocument document = await LoadArtworkAsync(releaseId, token).ConfigureAwait(false);
            if (!FrontImages(document.RootElement).Any(image => ImageId(image) == imageId))
            {
                throw Error("not_found", "The selected front cover is no longer available for this edition");
            }

            // Use the selected image identity at CAA, never a caller-supplied or JSON image URL.
            string suffix = preview ? "-250" : "";
            byte[] bytes = await ReadBytesAsync(new Uri($"https://coverartarchive.org/release/{releaseId:D}/{imageId}{suffix}"), preview ? 2 * 1024 * 1024 : 10 * 1024 * 1024, token).ConfigureAwait(false);
            (string contentType, string extension) = CoverImageValidation.Validate(bytes);
            var provenance = new CoverArtworkProvenance("coverArtArchive", releaseId, imageId, Source(releaseId), _time.GetUtcNow(), Convert.ToHexStringLower(SHA256.HashData(bytes)));
            return new DownloadedCoverArtwork(bytes, contentType, extension, $"cover-{imageId}{extension}", provenance);
        }, cancellationToken);
    }

    private async Task<JsonDocument> LoadArtworkAsync(Guid releaseId, CancellationToken token)
    {
        JsonDocument document = await ReadJsonAsync(new Uri($"https://coverartarchive.org/release/{releaseId:D}/"), token).ConfigureAwait(false);
        try
        {
            string? release = Text(document.RootElement, "release");
            if (release != $"https://musicbrainz.org/release/{releaseId:D}" && release != $"http://musicbrainz.org/release/{releaseId:D}")
            {
                throw Error("invalid_response", "The artwork provider returned a different edition");
            }
            _ = RequiredArray(document.RootElement, "images");
            return document;
        }
        catch
        {
            document.Dispose();
            throw;
        }
    }

    private async Task<JsonDocument> ReadJsonAsync(Uri uri, CancellationToken token)
    {
        byte[] bytes = await ReadBytesAsync(uri, 1024 * 1024, token).ConfigureAwait(false);
        return JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 32 });
    }

    private async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            throw Error("disabled", "External cover search is disabled");
        }
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.OperationTimeoutSeconds, 1, 60)));
        try
        {
            return await action(deadline.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw Error("timeout", "The artwork provider did not respond in time");
        }
        catch (HttpRequestException)
        {
            throw Error("unavailable", "The artwork provider could not be reached");
        }
        catch (IOException)
        {
            throw Error("unavailable", "The artwork provider response could not be read");
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException or OverflowException)
        {
            throw Error("invalid_response", "The artwork provider returned an invalid response");
        }
    }

    private static IEnumerable<JsonElement> FrontImages(JsonElement root) => RequiredArray(root, "images").EnumerateArray().Where(image => IsTrue(image, "front") || Items(image, "types").Any(type => type.ValueKind == JsonValueKind.String && type.GetString() == "Front")).Take(50);
    private static string Source(Guid id) => $"https://musicbrainz.org/release/{id:D}/cover-art";
    private static bool IsTrue(JsonElement value, string name) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.True;
    private static string? Text(JsonElement value, string name) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    private static string? NestedText(JsonElement value, string name, string child) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.Object ? Text(property, child) : null;
    private static IEnumerable<JsonElement> Items(JsonElement value, string name)
    {
        if (value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.Array)
        {
            foreach (JsonElement item in property.EnumerateArray())
            {
                yield return item;
            }
        }
    }
    private static JsonElement RequiredArray(JsonElement value, string name) => value.TryGetProperty(name, out JsonElement property) && property.ValueKind == JsonValueKind.Array ? property : throw Error("invalid_response", "The artwork provider returned an invalid response");
    private static string ImageId(JsonElement image)
    {
        if (!image.TryGetProperty("id", out JsonElement value))
        {
            throw Error("invalid_response", "The artwork provider returned an invalid image identity");
        }
        string id = value.ValueKind == JsonValueKind.Number ? value.GetRawText() : value.GetString() ?? "";
        ValidateImageId(id);
        return id;
    }
    private static void ValidateImageId(string id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > 30 || id.All(character => character == '0') || id.Any(character => character is < '0' or > '9'))
        {
            throw Error("invalid_image", "The image identity must contain only digits");
        }
    }
    private static void ValidateRelease(Guid id)
    {
        if (id == Guid.Empty)
        {
            throw Error("invalid_release", "A release edition is required");
        }
    }
    private static void AddTerm(List<string> terms, string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            terms.Add($"{name}:\"{Escape(RequiredQuery(value))}\"");
        }
    }

    private static string RequiredQuery(string value)
    {
        return string.IsNullOrWhiteSpace(value) || value.Length > 200 || value.Any(char.IsControl)
            ? throw Error("invalid_query", "Search fields must contain between one and 200 characters")
            : value.Trim();
    }
    private static string Escape(string value) => string.Concat(value.Select(character => "+-!(){}[]^\"~*?:\\/|&".Contains(character, StringComparison.Ordinal) ? $"\\{character}" : character.ToString(CultureInfo.InvariantCulture)));
    internal static DomainException Error(string code, string message) => new($"external_cover.{code}", message);
}
