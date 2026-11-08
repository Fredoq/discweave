using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

internal sealed partial class ApiTestHost
{
    public async Task<T> WithTrackMergeContextAsync<T>(Func<DiscWeaveDbContext, Task<T>> action)
    {
        await using AsyncServiceScope scope = _factory.Services.CreateAsyncScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        return await action(context);
    }
}
