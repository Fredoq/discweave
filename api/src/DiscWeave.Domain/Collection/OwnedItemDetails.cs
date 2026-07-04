using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Domain.Collection;

public sealed record OwnedItemDetails
{
    private const int NoteMaxLength = 2048;

    private OwnedItemDetails(IOptionalValue<ItemCondition>? condition, IOptionalValue<StorageLocation>? storageLocation, string note)
    {
        Condition = condition ?? Optional.Missing<ItemCondition>();
        StorageLocation = storageLocation ?? Optional.Missing<StorageLocation>();
        Note = ValidateNote(note);
    }

    public IOptionalValue<ItemCondition> Condition { get; }

    public IOptionalValue<StorageLocation> StorageLocation { get; }

    public string Note { get; }

    public static OwnedItemDetails Empty { get; } = new(
        Optional.Missing<ItemCondition>(),
        Optional.Missing<StorageLocation>(),
        string.Empty);

    public OwnedItemDetails WithCondition(ItemCondition condition)
    {
        return new OwnedItemDetails(Optional.From(condition), StorageLocation, Note);
    }

    public OwnedItemDetails WithStorageLocation(StorageLocation storageLocation)
    {
        ArgumentNullException.ThrowIfNull(storageLocation);

        return new OwnedItemDetails(Condition, Optional.From(storageLocation), Note);
    }

    public OwnedItemDetails WithNote(string note)
    {
        return new OwnedItemDetails(Condition, StorageLocation, note);
    }

    private static string ValidateNote(string note)
    {
        if (string.IsNullOrWhiteSpace(note))
        {
            return string.Empty;
        }

        string trimmed = note.Trim();
        return trimmed.Length <= NoteMaxLength
            ? trimmed
            : throw new DomainException(
                "owned_item.note_too_long",
                $"Owned item note must be at most {NoteMaxLength} characters");
    }
}
