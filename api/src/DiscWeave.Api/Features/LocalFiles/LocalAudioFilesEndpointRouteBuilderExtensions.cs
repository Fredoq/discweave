using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.LocalFiles;

public static class LocalAudioFilesEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapLocalAudioFilesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/local-audio-files")
            .WithTags("Local Files")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapPatch("/{localAudioFileId:guid}", UpdateLocalAudioFileAsync)
            .WithName("UpdateLocalAudioFile");

        return endpoints;
    }

    private static async Task<IResult> UpdateLocalAudioFileAsync(
        Guid localAudioFileId,
        UpdateLocalAudioFileRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        LocalAudioFile? file = await context.LocalAudioFiles.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == currentCollection.CollectionId && candidate.Id == new LocalAudioFileId(localAudioFileId),
            cancellationToken);
        if (file is null)
        {
            return EndpointErrors.NotFound("local_audio_file.not_found", "Local audio file was not found");
        }

        try
        {
            LocalAudioFileContractMapper.ApplyUpdate(file, request);
            _ = await context.SaveChangesAsync(cancellationToken);

            return Results.Ok(LocalAudioFileContractMapper.ToResponse(file));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ArgumentException)
        {
            return EndpointErrors.BadRequest("local_audio_file.request_invalid", "Local audio file request is invalid");
        }
    }
}
