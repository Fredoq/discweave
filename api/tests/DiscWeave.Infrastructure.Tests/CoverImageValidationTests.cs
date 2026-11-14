using System.Buffers.Binary;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

namespace DiscWeave.Infrastructure.Tests;

public sealed class CoverImageValidationTests
{
    // Synthetic framing only: these exercise the parser boundary, not image codec decoding.
    [Fact]
    public void Baseline_JPEG_framing_with_dimensions_and_a_scan_is_accepted()
    {
        Assert.Equal(("image/jpeg", ".jpg"), CoverImageValidation.Validate(Jpeg(16, 24)));
    }

    [Theory]
    [InlineData(0, 16)]
    [InlineData(12001, 16)]
    [InlineData(7000, 7000)]
    public void JPEG_frames_with_unsupported_dimensions_are_rejected(ushort width, ushort height)
    {
        AssertInvalid(Jpeg(width, height));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(7)]
    [InlineData(65535)]
    public void Invalid_JPEG_frame_segment_lengths_are_rejected(ushort length)
    {
        byte[] image = Jpeg(16, 24);
        BinaryPrimitives.WriteUInt16BigEndian(image.AsSpan(4, 2), length);
        AssertInvalid(image);
    }

    [Fact]
    public void JPEG_framing_requires_a_complete_end_marker()
    {
        byte[] image = Jpeg(16, 24);
        AssertInvalid(image.AsSpan(0, image.Length - 1));
    }

    [Fact]
    public void JPEG_scan_without_a_frame_is_rejected()
    {
        byte[] image = Jpeg(16, 24);
        image[3] = 0xe0;
        AssertInvalid(image);
    }

    [Theory]
    [InlineData("VP8 ")]
    [InlineData("VP8L")]
    [InlineData("VP8X")]
    public void Nonanimated_WebP_framing_is_accepted(string kind)
    {
        Assert.Equal(("image/webp", ".webp"), CoverImageValidation.Validate(WebP(kind, 16, 24)));
    }

    [Theory]
    [InlineData("VP8 ")]
    [InlineData("VP8L")]
    [InlineData("VP8X")]
    public void WebP_frames_with_oversized_dimensions_are_rejected(string kind)
    {
        AssertInvalid(WebP(kind, 12001, 24));
        AssertInvalid(WebP(kind, 7000, 7000));
    }

    [Fact]
    public void Animated_extended_WebP_is_rejected()
    {
        byte[] image = WebP("VP8X", 16, 24);
        image[20] = 2;
        AssertInvalid(image);
    }

    [Theory]
    [InlineData("VP8 ")]
    [InlineData("VP8L")]
    [InlineData("VP8X")]
    public void WebP_chunk_lengths_cannot_exceed_the_container(string kind)
    {
        byte[] image = WebP(kind, 16, 24);
        BinaryPrimitives.WriteUInt32LittleEndian(image.AsSpan(16, 4), uint.MaxValue);
        AssertInvalid(image);
    }

    [Theory]
    [InlineData("VP8 ")]
    [InlineData("VP8L")]
    [InlineData("VP8X")]
    public void Truncated_WebP_containers_are_rejected(string kind)
    {
        byte[] image = WebP(kind, 16, 24);
        AssertInvalid(image.AsSpan(0, image.Length - 1));
        // Even a matching RIFF length cannot authorize a truncated image chunk.
        BinaryPrimitives.WriteUInt32LittleEndian(image.AsSpan(4, 4), (uint)(image.Length - 9));
        AssertInvalid(image.AsSpan(0, image.Length - 1));
    }

    [Theory]
    [InlineData("VP8 ")]
    [InlineData("VP8L")]
    public void WebP_frame_signatures_are_checked(string kind)
    {
        byte[] image = WebP(kind, 16, 24);
        image[kind == "VP8 " ? 23 : 20] = 0;
        AssertInvalid(image);
    }

    [Fact]
    public void Extended_WebP_without_image_data_is_rejected()
    {
        byte[] image = WebP("VP8X", 16, 24);
        BinaryPrimitives.WriteUInt32LittleEndian(image.AsSpan(4, 4), 22);
        AssertInvalid(image.AsSpan(0, 30));
    }

    private static void AssertInvalid(ReadOnlySpan<byte> image)
    {
        // A span cannot be captured by the assertion lambda.
        byte[] bytes = image.ToArray();
        DomainException error = Assert.Throws<DomainException>(() => CoverImageValidation.Validate(bytes));
        Assert.Equal("external_cover.invalid_image", error.Code);
    }

    private static byte[] Jpeg(ushort width, ushort height)
    {
        byte[] image =
        [
            0xff, 0xd8,
            0xff, 0xc0, 0, 11, 8, 0, 0, 0, 0, 1, 1, 0x11, 0,
            0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0,
            0, 0xff, 0xd9
        ];
        BinaryPrimitives.WriteUInt16BigEndian(image.AsSpan(7, 2), height);
        BinaryPrimitives.WriteUInt16BigEndian(image.AsSpan(9, 2), width);
        return image;
    }

    private static byte[] WebP(string kind, ushort width, ushort height)
    {
        byte[] chunk = new byte[10];
        if (kind == "VP8X")
        {
            WriteUInt24(chunk.AsSpan(4, 3), (uint)(width - 1));
            WriteUInt24(chunk.AsSpan(7, 3), (uint)(height - 1));
            return Container(Chunk(kind, chunk), Chunk("VP8 ", LossyFrame(width, height)));
        }
        if (kind == "VP8L")
        {
            chunk[0] = 0x2f;
            BinaryPrimitives.WriteUInt32LittleEndian(chunk.AsSpan(1, 4), (uint)((width - 1) | ((height - 1) << 14)));
            return Container(Chunk(kind, chunk));
        }
        return Container(Chunk(kind, LossyFrame(width, height)));
    }

    private static byte[] LossyFrame(ushort width, ushort height)
    {
        byte[] chunk = [0, 0, 0, 0x9d, 1, 0x2a, 0, 0, 0, 0];
        BinaryPrimitives.WriteUInt16LittleEndian(chunk.AsSpan(6, 2), width);
        BinaryPrimitives.WriteUInt16LittleEndian(chunk.AsSpan(8, 2), height);
        return chunk;
    }

    private static byte[] Chunk(string kind, byte[] content)
    {
        byte[] bytes = new byte[8 + content.Length + (content.Length & 1)];
        _ = System.Text.Encoding.ASCII.GetBytes(kind, bytes.AsSpan(0, 4));
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4, 4), (uint)content.Length);
        content.CopyTo(bytes, 8);
        return bytes;
    }

    private static byte[] Container(params byte[][] chunks)
    {
        byte[] bytes = new byte[12 + chunks.Sum(chunk => chunk.Length)];
        "RIFF"u8.CopyTo(bytes);
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(4, 4), (uint)(bytes.Length - 8));
        "WEBP"u8.CopyTo(bytes.AsSpan(8, 4));
        int offset = 12;
        foreach (byte[] chunk in chunks)
        {
            chunk.CopyTo(bytes, offset);
            offset += chunk.Length;
        }
        return bytes;
    }

    private static void WriteUInt24(Span<byte> bytes, uint value)
    {
        bytes[0] = (byte)value;
        bytes[1] = (byte)(value >> 8);
        bytes[2] = (byte)(value >> 16);
    }
}
