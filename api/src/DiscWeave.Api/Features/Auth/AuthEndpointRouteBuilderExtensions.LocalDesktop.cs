using DiscWeave.Api.Http;
using DiscWeave.Infrastructure.Identity;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;

namespace DiscWeave.Api.Features.Auth;

public static partial class AuthEndpointRouteBuilderExtensions
{
    private static readonly SemaphoreSlim LocalBootstrapLock = new(1, 1);

    private static async Task<IResult> LocalBootstrapAsync(
        UserManager<DiscWeaveUser> userManager,
        SignInManager<DiscWeaveUser> signInManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        DiscWeaveDbContext context,
        CancellationToken cancellationToken)
    {
        if (!IsLocalDesktopMode())
        {
            return EndpointErrors.NotFound("auth.local_desktop_unavailable", "Local desktop bootstrap is unavailable");
        }

        await LocalBootstrapLock.WaitAsync(cancellationToken);
        try
        {
            DiscWeaveUser? user = await userManager.FindByEmailAsync(UserProvisioning.LocalOwnerEmail);
            if (user is null)
            {
                IdentityResult rolesResult = await UserProvisioning.EnsureRolesAsync(roleManager);
                if (!rolesResult.Succeeded)
                {
                    return IdentityError(rolesResult);
                }

                (IdentityResult createResult, user) = await UserProvisioning.CreateLocalOwnerWithCollectionAsync(
                    userManager,
                    context,
                    cancellationToken);
                if (!createResult.Succeeded || user is null)
                {
                    return IdentityError(createResult);
                }
            }

            if (user.IsDisabled ||
                user.DefaultCollectionId is null ||
                !await userManager.IsInRoleAsync(user, DiscWeaveRoles.Admin))
            {
                return EndpointErrors.Unauthorized("auth.local_owner_unavailable", "Local owner session is unavailable");
            }

            await signInManager.SignInAsync(user, isPersistent: true);
            return Results.Ok(await ToSessionResponseAsync(user, userManager));
        }
        finally
        {
            _ = LocalBootstrapLock.Release();
        }
    }

    private static bool IsLocalDesktopMode()
    {
        return string.Equals(
            Environment.GetEnvironmentVariable("DISCWEAVE_RUNTIME_MODE"),
            "LocalDesktop",
            StringComparison.OrdinalIgnoreCase);
    }
}
