using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Imports;

public sealed class LabelImportSessionLink
{
    private LabelImportSessionLink()
    {
    }

    private LabelImportSessionLink(CollectionId collectionId, LabelId labelId, ReleaseImportSessionId sessionId)
    {
        CollectionId = collectionId;
        LabelId = labelId;
        SessionId = sessionId;
        SourceKind = ReleaseImportSourceKind.LocalFiles;
    }

    public CollectionId CollectionId { get; private set; }
    public LabelId LabelId { get; private set; }
    public ReleaseImportSessionId SessionId { get; private set; }
    public ReleaseImportSourceKind SourceKind { get; private set; }

    public static LabelImportSessionLink Create(CollectionId collectionId, LabelId labelId, ReleaseImportSession session)
    {
        ArgumentNullException.ThrowIfNull(session);
        return session.CollectionId != collectionId || session.SourceKind != ReleaseImportSourceKind.LocalFiles
            ? throw new DomainException("label_import.invalid_session", "A label import source must be a local-file session in the same collection")
            : new LabelImportSessionLink(collectionId, labelId, session.Id);
    }
}
