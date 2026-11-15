using System.Net.Sockets;
using Microsoft.Extensions.Logging;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

public sealed partial class CoverArtArchiveProvider
{
    private static readonly Action<ILogger, HttpRequestError, string, string, Exception?> TransportFailure =
        LoggerMessage.Define<HttpRequestError, string, string>(
            LogLevel.Warning,
            new EventId(1101, "ExternalCoverTransportFailure"),
            "External cover request failed with {HttpRequestError}, inner type {InnerExceptionType}, socket error {SocketErrorCode}");

    private void LogTransportFailure(HttpRequestException exception)
    {
        // Only fixed diagnostic categories enter logs. Exception messages and objects may contain queries or credentials.
        string innerType = exception.InnerException?.GetType().Name ?? "None";
        string socketError = "None";
        Exception? inner = exception.InnerException;
        for (int depth = 0; depth < 8 && inner is not null; depth++)
        {
            if (inner is SocketException socket)
            {
                socketError = socket.SocketErrorCode.ToString();
                break;
            }
            inner = inner.InnerException;
        }
        TransportFailure(_logger, exception.HttpRequestError, innerType, socketError, null);
    }
}
