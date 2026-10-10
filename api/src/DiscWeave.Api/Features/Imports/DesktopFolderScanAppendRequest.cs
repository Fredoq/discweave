namespace DiscWeave.Api.Features.Imports;

public sealed record DesktopFolderScanAppendRequest(
    DesktopFolderScanRequest? Scan,
    IReadOnlyList<Guid>? ReplaceDraftIds);
