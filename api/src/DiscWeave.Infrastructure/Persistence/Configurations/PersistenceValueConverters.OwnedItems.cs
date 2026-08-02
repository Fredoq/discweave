using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal static partial class PersistenceValueConverters
{
    public static readonly ValueConverter<OwnedItemId?, Guid?> NullableOwnedItemId = new(
        id => id.HasValue ? id.Value.Value : null,
        value => value.HasValue ? new OwnedItemId(value.Value) : null);
}
