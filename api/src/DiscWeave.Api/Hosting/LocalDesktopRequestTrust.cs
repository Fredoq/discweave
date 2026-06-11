namespace DiscWeave.Api.Hosting;

internal static class LocalDesktopRequestTrust
{
    private const string ItemKey = "__DiscWeaveLocalDesktopTokenValidated";

    public static void MarkTrusted(HttpContext context)
    {
        context.Items[ItemKey] = true;
    }

    public static bool IsTrusted(HttpContext context)
    {
        return context.Items.TryGetValue(ItemKey, out object? value) && value is true;
    }
}
