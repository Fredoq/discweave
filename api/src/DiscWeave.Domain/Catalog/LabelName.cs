using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Catalog;

public static class LabelName
{
    public static string NormalizeDisplayName(string value)
    {
        return string.Join(' ', Guard.RequiredText(value, nameof(value), "label.name_required").Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    public static string NormalizeKey(string value)
    {
        return NormalizeDisplayName(value).ToLowerInvariant();
    }
}
