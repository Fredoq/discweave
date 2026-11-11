namespace DiscWeave.Infrastructure.LocalDesktop;

public sealed record ArchiveSchemaStatus(string Status, string UpgradeId, bool CanUpgrade, string? Code);
