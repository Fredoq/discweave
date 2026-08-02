using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace DiscWeave.Domain.Imports;

internal static class LengthFramedSha256
{
    internal static string Hash(IReadOnlyList<string> canonicalFields)
    {
        ArgumentNullException.ThrowIfNull(canonicalFields);
        using var stream = new MemoryStream();
        Span<byte> length = stackalloc byte[sizeof(uint)];
        foreach (string field in canonicalFields)
        {
            ArgumentNullException.ThrowIfNull(field);
            byte[] bytes = Encoding.UTF8.GetBytes(field);
            BinaryPrimitives.WriteUInt32BigEndian(length, checked((uint)bytes.Length));
            stream.Write(length);
            stream.Write(bytes);
        }

        return Convert.ToHexStringLower(SHA256.HashData(stream.GetBuffer().AsSpan(0, checked((int)stream.Length))));
    }
}
