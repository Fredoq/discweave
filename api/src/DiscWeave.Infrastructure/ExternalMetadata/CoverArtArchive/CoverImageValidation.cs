using System.Buffers.Binary;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

/// <summary>Checks supported raster framing and dimensions before any image reaches storage or a browser.</summary>
internal static class CoverImageValidation
{
    internal static (string ContentType, string Extension) Validate(ReadOnlySpan<byte> data)
    {
        if (data.Length >= 33 && data[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
        {
            ValidatePng(data);
            return ("image/png", ".png");
        }
        if (data.Length >= 4 && data[0] == 0xff && data[1] == 0xd8)
        {
            ValidateJpeg(data);
            return ("image/jpeg", ".jpg");
        }
        if (data.Length >= 30 && data[..4].SequenceEqual("RIFF"u8) && data.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            ValidateWebP(data);
            return ("image/webp", ".webp");
        }
        throw Invalid();
    }

    private static void Dimensions(uint width, uint height)
    {
        if (width == 0 || height == 0 || width > 12000 || height > 12000 || (ulong)width * height > 40_000_000)
        {
            throw CoverArtArchiveProvider.Error("invalid_image", "The cover image dimensions are unsupported");
        }
    }

    private static void ValidatePng(ReadOnlySpan<byte> data)
    {
        if (BinaryPrimitives.ReadUInt32BigEndian(data.Slice(8, 4)) != 13 || !data.Slice(12, 4).SequenceEqual("IHDR"u8))
        {
            throw Invalid();
        }
        Dimensions(BinaryPrimitives.ReadUInt32BigEndian(data.Slice(16, 4)), BinaryPrimitives.ReadUInt32BigEndian(data.Slice(20, 4)));
        bool imageData = false;
        for (int offset = 8; offset <= data.Length - 12;)
        {
            uint length = BinaryPrimitives.ReadUInt32BigEndian(data.Slice(offset, 4));
            if (length > (uint)(data.Length - offset - 12))
            {
                throw Invalid();
            }
            ReadOnlySpan<byte> kind = data.Slice(offset + 4, 4);
            if (kind.SequenceEqual("IDAT"u8))
            {
                imageData |= length > 0;
            }
            if (kind.SequenceEqual("IEND"u8))
            {
                if (!imageData || length != 0 || offset + 12 != data.Length)
                {
                    throw Invalid();
                }
                return;
            }
            offset += checked((int)length + 12);
        }
        throw Invalid();
    }

    private static void ValidateJpeg(ReadOnlySpan<byte> data)
    {
        if (data[^2] != 0xff || data[^1] != 0xd9)
        {
            throw Invalid();
        }
        bool dimensions = false;
        int offset = 2;
        while (offset < data.Length - 2)
        {
            if (data[offset++] != 0xff)
            {
                throw Invalid();
            }
            while (offset < data.Length && data[offset] == 0xff)
            {
                offset++;
            }
            if (offset >= data.Length)
            {
                throw Invalid();
            }
            byte marker = data[offset++];
            if (marker is 0x01 or (>= 0xd0 and <= 0xd7))
            {
                continue;
            }
            if (offset > data.Length - 2)
            {
                throw Invalid();
            }
            int length = BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset, 2));
            if (length < 2 || length > data.Length - offset)
            {
                throw Invalid();
            }
            if (marker is 0xc0 or 0xc1 or 0xc2)
            {
                if (length < 8)
                {
                    throw Invalid();
                }
                Dimensions(BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset + 5, 2)), BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset + 3, 2)));
                dimensions = true;
            }
            if (marker == 0xda)
            {
                if (!dimensions || offset + length >= data.Length - 2)
                {
                    throw Invalid();
                }
                return;
            }
            offset += length;
        }
        throw Invalid();
    }

    private static void ValidateWebP(ReadOnlySpan<byte> data)
    {
        if (BinaryPrimitives.ReadUInt32LittleEndian(data.Slice(4, 4)) != data.Length - 8)
        {
            throw Invalid();
        }
        bool imageData = false;
        for (int offset = 12; offset <= data.Length - 8;)
        {
            uint length = BinaryPrimitives.ReadUInt32LittleEndian(data.Slice(offset + 4, 4));
            if (length > (uint)(data.Length - offset - 8))
            {
                throw Invalid();
            }
            ReadOnlySpan<byte> kind = data.Slice(offset, 4);
            ReadOnlySpan<byte> chunk = data.Slice(offset + 8, (int)length);
            if (kind.SequenceEqual("VP8 "u8))
            {
                if (chunk.Length < 10 || !chunk.Slice(3, 3).SequenceEqual(new byte[] { 0x9d, 0x01, 0x2a }))
                {
                    throw Invalid();
                }
                Dimensions((uint)(BinaryPrimitives.ReadUInt16LittleEndian(chunk.Slice(6, 2)) & 0x3fff), (uint)(BinaryPrimitives.ReadUInt16LittleEndian(chunk.Slice(8, 2)) & 0x3fff));
                imageData = true;
            }
            if (kind.SequenceEqual("VP8L"u8))
            {
                if (chunk.Length < 5 || chunk[0] != 0x2f)
                {
                    throw Invalid();
                }
                uint bits = BinaryPrimitives.ReadUInt32LittleEndian(chunk.Slice(1, 4));
                Dimensions((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
                imageData = true;
            }
            if (kind.SequenceEqual("VP8X"u8))
            {
                if (chunk.Length != 10 || (chunk[0] & 2) != 0)
                {
                    throw Invalid();
                } // No animation.
                Dimensions(UInt24(chunk.Slice(4, 3)) + 1, UInt24(chunk.Slice(7, 3)) + 1);
            }
            offset += checked(8 + (int)length + ((int)length & 1));
            if (offset == data.Length && imageData)
            {
                return;
            }
        }
        throw Invalid();
    }

    private static uint UInt24(ReadOnlySpan<byte> bytes) => (uint)(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16));
    private static DiscWeave.Domain.SharedKernel.Errors.DomainException Invalid() => CoverArtArchiveProvider.Error("invalid_image", "The provider response is not a supported complete raster image");
}
