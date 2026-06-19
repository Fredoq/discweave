using DiscWeave.Application.Persistence;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence;

public partial class DiscWeaveDbContext : IRepository<LocalAudioFile, LocalAudioFileId>
{
    async Task<LocalAudioFile?> IRepository<LocalAudioFile, LocalAudioFileId>.TryFindAsync(
        LocalAudioFileId key,
        CancellationToken cancellationToken)
    {
        return await LocalAudioFiles.FirstOrDefaultAsync(file => file.Id == key, cancellationToken);
    }

    void IRepository<LocalAudioFile, LocalAudioFileId>.Add(LocalAudioFile aggregate)
    {
        _ = LocalAudioFiles.Add(aggregate);
    }

    void IRepository<LocalAudioFile, LocalAudioFileId>.Delete(LocalAudioFile aggregate)
    {
        _ = LocalAudioFiles.Remove(aggregate);
    }
}
