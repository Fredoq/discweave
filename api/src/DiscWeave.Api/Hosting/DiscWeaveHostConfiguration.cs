using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Infrastructure.Identity;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Primitives;

namespace DiscWeave.Api.Hosting;

public static class DiscWeaveHostConfiguration
{
    public static IServiceCollection AddDiscWeaveAuthentication(
        this IServiceCollection services,
        IWebHostEnvironment environment)
    {
        _ = services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();
        _ = services.Configure<SecurityStampValidatorOptions>(options =>
        {
            options.ValidationInterval = TimeSpan.Zero;
        });
        _ = services.ConfigureApplicationCookie(options => ConfigureApplicationCookie(options, environment));

        return services;
    }

    public static IServiceCollection AddDiscWeaveRequestContext(this IServiceCollection services)
    {
        _ = services.AddHttpContextAccessor();
        _ = services.AddScoped<ICurrentUser, HttpCurrentUser>();
        _ = services.AddScoped<ICurrentCollection, HttpCurrentCollection>();
        _ = services.AddScoped(provider =>
        {
            DbContextOptions<DiscWeaveDbContext> options = provider.GetRequiredService<DbContextOptions<DiscWeaveDbContext>>();
            ClaimsPrincipal? user = provider.GetRequiredService<IHttpContextAccessor>().HttpContext?.User;

            return HasValidCollectionScope(user)
                ? new DiscWeaveDbContext(options, provider.GetRequiredService<ICurrentCollection>())
                : new DiscWeaveDbContext(options);
        });
        _ = services.AddAuthorizationBuilder()
            .AddPolicy(DiscWeaveAuthorizationPolicies.Admin, policy => policy.RequireRole(DiscWeaveRoles.Admin))
            .AddPolicy(DiscWeaveAuthorizationPolicies.CollectionMember, policy =>
            {
                _ = policy.RequireAuthenticatedUser();
                _ = policy.RequireAssertion(context => HasValidCollectionScope(context.User));
            });

        return services;
    }

    public static void UseLocalDesktopRequestTrust(this WebApplication app, IConfiguration configuration)
    {
        _ = app.Use(async (context, next) =>
        {
            if (!IsLocalDesktopMode())
            {
                await next();
                return;
            }

            string? expectedToken = configuration["DiscWeave:LocalDesktop:Token"];
            if (string.IsNullOrWhiteSpace(expectedToken))
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                await context.Response.WriteAsJsonAsync(new ErrorResponse(
                    "local_desktop.token_not_configured",
                    "Local desktop token is not configured"));
                return;
            }

            if (!context.Request.Headers.TryGetValue("x-discweave-local-token", out StringValues providedToken) ||
                providedToken.Count != 1 ||
                !TokenMatches(expectedToken, providedToken[0]))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new ErrorResponse(
                    "local_desktop.token_required",
                    "Local desktop token is required"));
                return;
            }

            LocalDesktopRequestTrust.MarkTrusted(context);
            await next();
        });
    }

    public static bool UsesSqliteStorage(IConfiguration configuration)
    {
        string? configuredProvider = configuration["DiscWeave:StorageProvider"];
        return string.IsNullOrWhiteSpace(configuredProvider) ||
            string.Equals(configuredProvider, "Sqlite", StringComparison.OrdinalIgnoreCase);
    }

    public static async Task InitializeSqliteDatabaseAsync(IServiceProvider services)
    {
        await using AsyncServiceScope scope = services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        _ = await context.Database.EnsureCreatedAsync();
    }

    private static void ConfigureApplicationCookie(
        CookieAuthenticationOptions options,
        IWebHostEnvironment environment)
    {
        options.Cookie.Name = "DiscWeave.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.LoginPath = "/api/auth/login";
        options.AccessDeniedPath = "/api/auth/forbidden";
        options.ReturnUrlParameter = CookieAuthenticationDefaults.ReturnUrlParameter;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(14);
        options.Events.OnRedirectToLogin = context => WriteErrorAsync(
            context.Response,
            StatusCodes.Status401Unauthorized,
            "auth.unauthenticated",
            "User is not authenticated");
        options.Events.OnRedirectToAccessDenied = context => WriteErrorAsync(
            context.Response,
            StatusCodes.Status403Forbidden,
            "auth.forbidden",
            "User is not authorized for this action");
        options.Events.OnValidatePrincipal = ValidatePrincipalAsync;
    }

    private static async Task ValidatePrincipalAsync(CookieValidatePrincipalContext context)
    {
        await SecurityStampValidator.ValidatePrincipalAsync(context);
        if (context.Principal?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        string? userId = context.Principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out Guid parsedUserId))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);

            return;
        }

        UserManager<DiscWeaveUser> userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<DiscWeaveUser>>();
        DiscWeaveUser? user = await userManager.FindByIdAsync(parsedUserId.ToString());
        if (user is null || user.IsDisabled || user.DefaultCollectionId is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(IdentityConstants.ApplicationScheme);
        }
    }

    private static bool HasValidCollectionScope(ClaimsPrincipal? user)
    {
        string? collectionId = user?.FindFirstValue(DiscWeaveClaimTypes.DefaultCollectionId);

        return user?.Identity?.IsAuthenticated == true &&
            Guid.TryParse(collectionId, out Guid parsedCollectionId) &&
            parsedCollectionId != Guid.Empty;
    }

    private static bool IsLocalDesktopMode()
    {
        return string.Equals(
            Environment.GetEnvironmentVariable("DISCWEAVE_RUNTIME_MODE"),
            "LocalDesktop",
            StringComparison.OrdinalIgnoreCase);
    }

    private static bool TokenMatches(string expectedToken, string? providedToken)
    {
        if (string.IsNullOrEmpty(providedToken))
        {
            return false;
        }

        byte[] expectedBytes = Encoding.UTF8.GetBytes(expectedToken);
        byte[] providedBytes = Encoding.UTF8.GetBytes(providedToken);

        return expectedBytes.Length == providedBytes.Length &&
            CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }

    private static Task WriteErrorAsync(HttpResponse response, int statusCode, string code, string message)
    {
        response.StatusCode = statusCode;

        return response.WriteAsJsonAsync(new ErrorResponse(code, message));
    }
}
