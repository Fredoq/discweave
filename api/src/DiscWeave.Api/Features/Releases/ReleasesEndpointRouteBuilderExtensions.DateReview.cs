using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DiscWeave.Api.Features.ExternalMetadata;
using DiscWeave.Api.Http;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private const string DatePreviewPurpose = "DiscWeave.ReleaseDatePreview.v1";

    private static async Task<IResult> PreviewReleaseDateAsync(
        Guid releaseId,
        ReleaseDatePreviewRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection collection,
        IExternalMetadataProviderResolver providers,
        IDataProtectionProvider protection,
        CancellationToken cancellationToken)
    {
        string? externalId = request.DiscogsReleaseId?.Trim();
        if (string.IsNullOrEmpty(externalId) || externalId.Length > 15 ||
            externalId[0] == '0' || externalId.Any(character => character is < '0' or > '9'))
        {
            return EndpointErrors.BadRequest("release_date.source_invalid", "Choose a Discogs release edition by its numeric id");
        }

        // Check access before making an external request. Do not hold a database transaction over network I/O.
        if (!await context.Releases.AnyAsync(release => release.CollectionId == collection.CollectionId &&
            release.Id == new ReleaseId(releaseId), cancellationToken))
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }

        ExternalMetadataResult<IExternalMetadataProvider> provider = providers.Resolve("discogs");
        if (!provider.IsSuccess)
        {
            return ExternalMetadataEndpointErrors.ToHttpResult(provider.Error);
        }

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await provider.Value.GetReleaseAsync(
            new ExternalMetadataLookupQuery(externalId), cancellationToken);
        if (!result.IsSuccess)
        {
            return ExternalMetadataEndpointErrors.ToHttpResult(result.Error);
        }

        ExternalMetadataReleaseDetail detail = result.Value;
        if (detail.Source.ProviderName != "discogs" || detail.Source.ResourceType != "release" || detail.Source.ExternalId != externalId)
        {
            return Results.UnprocessableEntity(new { Code = "release_date.source_invalid", Message = "The source must identify the selected Discogs release edition, not a master release" });
        }

        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        Release? release = await LoadDateReviewReleaseAsync(releaseId, context, collection.CollectionId, cancellationToken);
        if (release is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }

        ReleaseResponse current = await ToReleaseResponseAsync(release, context, collection.CollectionId, cancellationToken);
        ExternalMetadataPartialDate? evidence = detail.ReleaseDateEvidence is PresentOptionalValue<ExternalMetadataPartialDate> present ? present.Value : null;
        string? token = evidence is ExternalMetadataPartialDate.FullDate fullDate
            ? protection.CreateProtector(DatePreviewPurpose).ToTimeLimitedDataProtector().Protect(
                JsonSerializer.Serialize(new ReleaseDatePreviewToken(collection.CollectionId.Value, releaseId, DateReviewFingerprint(current), fullDate.Value)),
                TimeSpan.FromMinutes(10))
            : null;
        return Results.Ok(new ReleaseDatePreviewResponse(
            token, current.Year, current.ReleaseDate, current.Title,
            [.. current.ArtistCredits.Select(credit => credit.ArtistName)],
            [.. current.Labels.Select(label => label.CatalogNumber).OfType<string>()],
            [.. current.Labels.Select(label => label.Name)], detail.Source, detail.Title, detail.Artists, detail.CatalogNumber, detail.Labels, detail.Formats,
            DateEvidenceResponse(evidence)));
    }

    private static async Task<IResult> ApplyReleaseDateAsync(
        Guid releaseId,
        ReleaseDateApplyRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection collection,
        IDataProtectionProvider protection,
        CancellationToken cancellationToken)
    {
        if (!request.Confirmed || string.IsNullOrWhiteSpace(request.Token))
        {
            return EndpointErrors.BadRequest("release_date.confirmation_required", "Review the edition and explicitly confirm its date before applying");
        }

        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction = await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        Release? release = await LoadDateReviewReleaseAsync(releaseId, context, collection.CollectionId, cancellationToken);
        if (release is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }

        ReleaseDatePreviewToken? preview = ReadDatePreviewToken(protection, request.Token);
        ReleaseResponse current = await ToReleaseResponseAsync(release, context, collection.CollectionId, cancellationToken);
        if (preview is null || preview.CollectionId != collection.CollectionId.Value || preview.ReleaseId != releaseId ||
            preview.Fingerprint != DateReviewFingerprint(current))
        {
            return EndpointErrors.Conflict("release_date.preview_stale", "The release changed or the preview expired; review a fresh date preview");
        }

        ReleaseMetadata metadata = release.Summary.Metadata.WithReleaseYear(preview.Date.Year).WithReleaseDate(preview.Date);
        release.UpdateSummary(release.Summary.WithMetadata(metadata));
        _ = await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(new { ReleaseId = releaseId, ReleaseDate = preview.Date });
    }

    private static Task<Release?> LoadDateReviewReleaseAsync(Guid releaseId, DiscWeaveDbContext context, CollectionId collectionId, CancellationToken cancellationToken)
    {
        return context.Releases.Include("_externalSources").SingleOrDefaultAsync(
            release => release.CollectionId == collectionId && release.Id == new ReleaseId(releaseId), cancellationToken);
    }

    private static string DateReviewFingerprint(ReleaseResponse response)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(response))));
    }

    private static ReleaseDatePreviewToken? ReadDatePreviewToken(IDataProtectionProvider protection, string token)
    {
        try
        {
            string payload = protection.CreateProtector(DatePreviewPurpose).ToTimeLimitedDataProtector().Unprotect(token);
            return JsonSerializer.Deserialize<ReleaseDatePreviewToken>(payload);
        }
        catch (Exception exception) when (exception is CryptographicException or JsonException or FormatException)
        {
            return null;
        }
    }

    private static object? DateEvidenceResponse(ExternalMetadataPartialDate? evidence)
    {
        return evidence switch
        {
            ExternalMetadataPartialDate.FullDate date => new ExternalMetadataPartialDateResponse.FullDate(date.Year, date.Month, date.Day),
            ExternalMetadataPartialDate.YearMonth month => new ExternalMetadataPartialDateResponse.YearMonth(month.Year, month.Month),
            ExternalMetadataPartialDate.YearOnly year => new ExternalMetadataPartialDateResponse.YearOnly(year.Year),
            _ => null
        };
    }
}
