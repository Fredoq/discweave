namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct LocalAudioFileId(Guid Value)
{
    public static LocalAudioFileId New()
    {
        return new LocalAudioFileId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
