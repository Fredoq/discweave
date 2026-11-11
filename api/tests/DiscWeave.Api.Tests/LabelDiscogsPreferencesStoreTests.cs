using System.Text.Json;
using DiscWeave.Api.Features.Labels;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.Configuration;

namespace DiscWeave.Api.Tests;

public sealed class LabelDiscogsPreferencesStoreTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "discweave-labels-" + Guid.NewGuid());

    [Fact(DisplayName = "Label preferences survive reopening and stay isolated by collection and label")]
    public async Task Label_preferences_survive_reopening_and_stay_isolated_by_collection_and_label()
    {
        IConfiguration configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DiscWeave:LabelDiscogsPreferencesDirectory"] = _directory
        }).Build();
        var collection = CollectionId.New();
        var label = LabelId.New();
        using (var store = new LabelDiscogsPreferencesStore(configuration))
        {
            Assert.Null((await store.ReadAsync(collection, label, CancellationToken.None)).DiscogsLabelId);
            await store.SaveAsync(collection, label, new("123", "Label", ["ABC"]), CancellationToken.None);
        }

        using var reopened = new LabelDiscogsPreferencesStore(configuration);
        LabelDiscogsPreferences saved = await reopened.ReadAsync(collection, label, CancellationToken.None);
        Assert.Equal("123", saved.DiscogsLabelId);
        Assert.Equal("ABC", Assert.Single(saved.Prefixes));
        Assert.Null((await reopened.ReadAsync(CollectionId.New(), label, CancellationToken.None)).DiscogsLabelId);
        Assert.Null((await reopened.ReadAsync(collection, LabelId.New(), CancellationToken.None)).DiscogsLabelId);
        await reopened.SaveAsync(collection, label, LabelDiscogsPreferences.Empty, CancellationToken.None);
        Assert.Null((await reopened.ReadAsync(collection, label, CancellationToken.None)).DiscogsLabelId);
        Assert.Empty(Directory.GetFiles(_directory, "*.tmp"));
    }

    [Fact(DisplayName = "Oversized preferences are rejected without overwriting the file")]
    public async Task Oversized_preferences_are_rejected_without_overwriting_the_file()
    {
        _ = Directory.CreateDirectory(_directory);
        var collection = CollectionId.New();
        var label = LabelId.New();
        string path = Path.Combine(_directory, $"{collection.Value:N}-{label.Value:N}.json");
        await File.WriteAllTextAsync(path, new string('x', 40000));
        IConfiguration configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DiscWeave:LabelDiscogsPreferencesDirectory"] = _directory
        }).Build();
        using var store = new LabelDiscogsPreferencesStore(configuration);
        _ = await Assert.ThrowsAsync<IOException>(() => store.ReadAsync(collection, label, CancellationToken.None));
        Assert.Equal(40000, new FileInfo(path).Length);
    }

    [Fact(DisplayName = "Malformed stored preferences fail safely and are not replaced")]
    public async Task Malformed_stored_preferences_fail_safely_and_are_not_replaced()
    {
        _ = Directory.CreateDirectory(_directory);
        var collection = CollectionId.New();
        var label = LabelId.New();
        string path = Path.Combine(_directory, $"{collection.Value:N}-{label.Value:N}.json");
        const string malformed = /*lang=json,strict*/ "{\"DiscogsLabelId\":\"123\",\"DiscogsLabelName\":\"Label\",\"Prefixes\":null}";
        await File.WriteAllTextAsync(path, malformed);
        IConfiguration configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DiscWeave:LabelDiscogsPreferencesDirectory"] = _directory
        }).Build();
        using var store = new LabelDiscogsPreferencesStore(configuration);
        _ = await Assert.ThrowsAsync<JsonException>(() => store.ReadAsync(collection, label, CancellationToken.None));
        Assert.Equal(malformed, await File.ReadAllTextAsync(path));
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }
}
