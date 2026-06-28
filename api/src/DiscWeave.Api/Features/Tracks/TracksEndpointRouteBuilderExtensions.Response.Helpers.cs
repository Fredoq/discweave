using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static int? OptionalInt(IOptionalValue<int>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => 0) : null;
    }
}
