using DiscWeave.Application.Catalog.TrackStacks;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddDiscWeaveApplication(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        _ = services.AddSingleton<TrackStackRelationValidator>();

        return services;
    }
}
