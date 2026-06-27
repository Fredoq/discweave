namespace DiscWeave.Api.Tests.Architecture;

public sealed class SqliteSchemaPolicyTests
{
    [Fact(DisplayName = "SQLite startup uses the current EF model without manual schema upgraders")]
    public void SqliteStartupUsesCurrentEfModelWithoutManualSchemaUpgraders()
    {
        DirectoryInfo repositoryRoot = RepositoryRoot.Find();
        string programSource = File.ReadAllText(Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Api", "Program.cs"));
        string persistencePath = Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Infrastructure", "Persistence");

        Assert.DoesNotContain("SqliteSchemaUpgrader", programSource);
        Assert.Empty(Directory.EnumerateFiles(persistencePath, "SqliteSchemaUpgrader*.cs", SearchOption.TopDirectoryOnly));
    }
}
