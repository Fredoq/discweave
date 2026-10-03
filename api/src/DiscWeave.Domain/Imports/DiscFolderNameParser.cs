namespace DiscWeave.Domain.Imports;

public sealed class DiscFolderNameParser
{
    public const string DiscToken = "{disc}";
    private const int MaxMarkerLength = 64;

    public static readonly string[] DefaultTemplates =
    [
        "CD {disc}",
        "Disc {disc}",
        "Disk {disc}",
        "Part {disc}",
        "CD {disc} - {discTitle}",
        "Disc {disc} - {discTitle}",
        "Disk {disc} - {discTitle}",
        "Part {disc} - {discTitle}"
    ];

    private readonly ImportTemplatePattern[] _patterns;

    private DiscFolderNameParser(ImportTemplatePattern[] patterns)
    {
        _patterns = patterns;
    }

    public static DiscFolderNameParser Create(IReadOnlyList<string> templates)
    {
        ArgumentNullException.ThrowIfNull(templates);

        return new DiscFolderNameParser(
        [
            .. templates
                .Where(template => template.Contains(DiscToken, StringComparison.Ordinal))
                .Distinct(StringComparer.Ordinal)
                .Select(ImportTemplatePattern.Compile)
        ]);
    }

    public static ParsedDiscFolder? Parse(string folderName, IReadOnlyList<string> templates)
    {
        return Create(templates).Parse(folderName);
    }

    public ParsedDiscFolder? Parse(string folderName)
    {
        ArgumentNullException.ThrowIfNull(folderName);

        foreach (ImportTemplatePattern pattern in _patterns)
        {
            ImportPatternMatch? match = pattern.Match(folderName);
            if (match is not null &&
                match.Values.TryGetValue("disc", out string? disc) &&
                int.TryParse(disc, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out int number))
            {
                string marker = match.Values[ImportTemplatePattern.DiscMarkerKey];
                return new ParsedDiscFolder(
                    number,
                    marker.Length > MaxMarkerLength ? marker[..MaxMarkerLength].TrimEnd() : marker,
                    match.Values.TryGetValue("discTitle", out string? title) && !string.IsNullOrWhiteSpace(title) ? title.Trim() : null,
                    match.Template);
            }
        }

        return null;
    }

    public bool IsDiscFolder(string folderName)
    {
        return Parse(folderName) is not null;
    }
}

public sealed record ParsedDiscFolder(int Number, string Marker, string? Title, string MatchedTemplate);
