namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class CollectionSearchQueries
{
    private static string DisplayRole(string role)
    {
        return role switch
        {
            "mainartist" => "mainArtist",
            "featuredartist" => "featuredArtist",
            _ => role
        };
    }

    private static string DisplayStatus(string status)
    {
        return status == "needsdigitization" ? "needsDigitization" : status;
    }

    private static string DisplaySignal(string signal)
    {
        return signal switch
        {
            "physicalwithoutdigital" => "physicalWithoutDigital",
            "lossywithoutlossless" => "lossyWithoutLossless",
            "wantednotowned" => "wantedNotOwned",
            "needsdigitization" => "needsDigitization",
            _ => signal
        };
    }
}
