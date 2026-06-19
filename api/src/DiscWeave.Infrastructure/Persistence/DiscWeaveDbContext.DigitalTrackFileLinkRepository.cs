using DiscWeave.Application.Persistence;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence;

public partial class DiscWeaveDbContext : IRepository<DigitalTrackFileLink, DigitalTrackFileLinkId>
{
    async Task<DigitalTrackFileLink?> IRepository<DigitalTrackFileLink, DigitalTrackFileLinkId>.TryFindAsync(
        DigitalTrackFileLinkId key,
        CancellationToken cancellationToken)
    {
        return await DigitalTrackFileLinks.FirstOrDefaultAsync(link => link.Id == key, cancellationToken);
    }

    void IRepository<DigitalTrackFileLink, DigitalTrackFileLinkId>.Add(DigitalTrackFileLink aggregate)
    {
        _ = DigitalTrackFileLinks.Add(aggregate);
    }

    void IRepository<DigitalTrackFileLink, DigitalTrackFileLinkId>.Delete(DigitalTrackFileLink aggregate)
    {
        _ = DigitalTrackFileLinks.Remove(aggregate);
    }
}
