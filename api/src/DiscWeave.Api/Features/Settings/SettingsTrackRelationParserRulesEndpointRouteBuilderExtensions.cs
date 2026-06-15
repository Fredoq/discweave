using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Settings;

public static class SettingsTrackRelationParserRulesEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapSettingsTrackRelationParserRulesEndpoints(this IEndpointRouteBuilder endpoints)
    {
        RouteGroupBuilder group = endpoints.MapGroup("/api/settings/track-relation-parser-rules")
            .WithTags("Settings")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapGet("", ListTrackRelationParserRulesAsync).WithName("ListTrackRelationParserRules");
        _ = group.MapPost("", CreateTrackRelationParserRuleAsync).WithName("CreateTrackRelationParserRule");
        _ = group.MapPut("/{ruleId:guid}", UpdateTrackRelationParserRuleAsync).WithName("UpdateTrackRelationParserRule");
        _ = group.MapDelete("/{ruleId:guid}", DeleteTrackRelationParserRuleAsync).WithName("DeleteTrackRelationParserRule");

        return endpoints;
    }

    private static async Task<IResult> ListTrackRelationParserRulesAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        TrackRelationParserRule[] rules = await context.TrackRelationParserRules.AsNoTracking()
            .Where(rule => rule.CollectionId == currentCollection.CollectionId)
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.RelationTypeCode)
            .ThenBy(rule => rule.Alias)
            .ToArrayAsync(cancellationToken);

        return Results.Ok(new ListResponse<TrackRelationParserRuleResponse>([.. rules.Select(ToResponse)], rules.Length, 0, rules.Length));
    }

    private static async Task<IResult> CreateTrackRelationParserRuleAsync(
        TrackRelationParserRuleRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            string relationTypeCode = await RequireActiveRelationTypeCodeAsync(context, currentCollection.CollectionId, request.RelationTypeCode, cancellationToken);
            var rule = TrackRelationParserRule.Create(
                currentCollection.CollectionId,
                TrackRelationParserRuleId.New(),
                relationTypeCode,
                request.Alias,
                TrackRelationParserRuleMatchModeMapper.Parse(request.MatchMode),
                request.Confidence,
                TrackRelationParserRuleDirectionMapper.Parse(request.Direction),
                request.SortOrder ?? 100,
                request.IsActive ?? true,
                isBuiltin: false);

            _ = context.TrackRelationParserRules.Add(rule);
            _ = await context.SaveChangesAsync(cancellationToken);

            return Results.Created($"/api/settings/track-relation-parser-rules/{rule.Id.Value}", ToResponse(rule));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ResourceConflictException)
        {
            return EndpointErrors.Conflict("track_relation_parser_rule.conflict", "Track relation parser rule already exists");
        }
    }

    private static async Task<IResult> UpdateTrackRelationParserRuleAsync(
        Guid ruleId,
        TrackRelationParserRuleRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        TrackRelationParserRule? rule = await FindRuleAsync(context, currentCollection.CollectionId, ruleId, cancellationToken);
        if (rule is null)
        {
            return EndpointErrors.NotFound("track_relation_parser_rule.not_found", "Track relation parser rule was not found");
        }

        try
        {
            string relationTypeCode = await RequireActiveRelationTypeCodeAsync(context, currentCollection.CollectionId, request.RelationTypeCode, cancellationToken);
            rule.Update(
                relationTypeCode,
                request.Alias,
                TrackRelationParserRuleMatchModeMapper.Parse(request.MatchMode),
                request.Confidence,
                TrackRelationParserRuleDirectionMapper.Parse(request.Direction),
                request.SortOrder ?? rule.SortOrder,
                request.IsActive ?? rule.IsActive);
            _ = await context.SaveChangesAsync(cancellationToken);

            return Results.Ok(ToResponse(rule));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ResourceConflictException)
        {
            return EndpointErrors.Conflict("track_relation_parser_rule.conflict", "Track relation parser rule already exists");
        }
    }

    private static async Task<IResult> DeleteTrackRelationParserRuleAsync(
        Guid ruleId,
        HttpRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!DeleteConfirmation.Matches(request, "track-relation-parser-rule", ruleId))
        {
            return EndpointErrors.DeleteConfirmationRequired();
        }

        TrackRelationParserRule? rule = await FindRuleAsync(context, currentCollection.CollectionId, ruleId, cancellationToken);
        if (rule is null)
        {
            return EndpointErrors.NotFound("track_relation_parser_rule.not_found", "Track relation parser rule was not found");
        }

        _ = context.TrackRelationParserRules.Remove(rule);
        _ = await context.SaveChangesAsync(cancellationToken);

        return Results.NoContent();
    }

    private static async Task<TrackRelationParserRule?> FindRuleAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Guid ruleId,
        CancellationToken cancellationToken)
    {
        return await context.TrackRelationParserRules.SingleOrDefaultAsync(
            rule => rule.CollectionId == collectionId && rule.Id == new TrackRelationParserRuleId(ruleId),
            cancellationToken);
    }

    private static async Task<string> RequireActiveRelationTypeCodeAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string relationTypeCode,
        CancellationToken cancellationToken)
    {
        return await DictionaryValidation.RequireActiveCodeAsync(
            context,
            collectionId,
            DictionaryKind.TrackRelationType,
            relationTypeCode,
            "track_relation_parser_rule.relation_type_invalid",
            "Track relation type is invalid",
            cancellationToken);
    }

    private static TrackRelationParserRuleResponse ToResponse(TrackRelationParserRule rule)
    {
        return new TrackRelationParserRuleResponse(
            rule.Id.Value,
            rule.RelationTypeCode,
            rule.Alias,
            TrackRelationParserRuleMatchModeMapper.ToCode(rule.MatchMode),
            rule.Confidence,
            TrackRelationParserRuleDirectionMapper.ToCode(rule.Direction),
            rule.SortOrder,
            rule.IsActive,
            rule.IsBuiltin);
    }
}
