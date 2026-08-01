using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public static class DiscogsReleaseRowFingerprint
{
    public static string Create(
        string? position,
        string? title,
        IReadOnlyList<string> artistCredit,
        TimeSpan? duration)
    {
        ArgumentNullException.ThrowIfNull(artistCredit);

        string[] fields =
        [
            NormalizeText(position),
            NormalizeText(title),
            string.Join(
                ' ',
                artistCredit
                    .Select(NormalizeText)
                    .Where(value => value.Length > 0)),
            duration is TimeSpan presentDuration
                ? Convert.ToInt64(
                    Math.Round(
                        presentDuration.TotalMilliseconds,
                        MidpointRounding.AwayFromZero))
                    .ToString(CultureInfo.InvariantCulture)
                : "missing"
        ];
        using var stream = new MemoryStream();
        Span<byte> length = stackalloc byte[sizeof(uint)];
        foreach (string field in fields)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(field);
            BinaryPrimitives.WriteUInt32BigEndian(
                length,
                checked((uint)bytes.Length));
            stream.Write(length);
            stream.Write(bytes);
        }

        return Convert.ToHexStringLower(
            SHA256.HashData(stream.GetBuffer().AsSpan(0, (int)stream.Length)));
    }

    internal static string NormalizeText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = new StringBuilder(value.Length);
        bool pendingSpace = false;
        foreach (Rune rune in value.Normalize(NormalizationForm.FormKC)
            .ToLowerInvariant()
            .EnumerateRunes())
        {
            if (Rune.IsWhiteSpace(rune))
            {
                pendingSpace = normalized.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = normalized.Append(' ');
                pendingSpace = false;
            }

            _ = normalized.Append(rune);
        }

        return normalized.ToString();
    }
}
