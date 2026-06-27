namespace DiscWeave.Api.Tests.Architecture;

public sealed class SqliteSchemaPolicyTests
{
    [Fact(DisplayName = "SQLite startup uses EF schema creation plus current-model schema repair")]
    public void SqliteStartupUsesEfSchemaCreationPlusCurrentModelSchemaRepair()
    {
        DirectoryInfo repositoryRoot = RepositoryRoot.Find();
        string programSource = File.ReadAllText(Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Api", "Program.cs"));
        string persistencePath = Path.Combine(repositoryRoot.FullName, "src", "DiscWeave.Infrastructure", "Persistence");

        Assert.Contains("EnsureCreatedAsync", programSource);
        Assert.Contains("SqliteCurrentSchemaRepair.ApplyAsync", programSource);
        Assert.Contains(
            Path.Combine(persistencePath, "SqliteCurrentSchemaRepair.cs"),
            Directory.EnumerateFiles(persistencePath, "SqliteCurrentSchemaRepair*.cs", SearchOption.TopDirectoryOnly));
    }
}
