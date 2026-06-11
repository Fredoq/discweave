namespace DiscWeave.Api.Hosting;

public static class ProductionSecurityRateLimitPolicies
{
    public const string Auth = "auth";
    public const string Lifecycle = "lifecycle";
    public const string DesktopImport = "desktop-import";
    public const string Export = "export";
    public const string LocalDesktop = "local-desktop";
    public const string Unlimited = "unlimited";
}
