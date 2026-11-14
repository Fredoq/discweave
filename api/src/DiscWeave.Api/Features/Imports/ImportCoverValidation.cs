using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Imports;

internal static class ImportCoverValidation
{
    public const int MaximumBytes = 10 * 1024 * 1024;

    public static string Validate(string fileName, string contentType, byte[] content)
    {
        string extension = Path.GetExtension(fileName).ToLowerInvariant();
        string expected = extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => string.Empty
        };
        if (expected.Length == 0 || !string.Equals(expected, contentType, StringComparison.OrdinalIgnoreCase))
        {
            throw new DomainException("release_import.cover_format_invalid", "Cover must be a JPEG, PNG, or WebP image with a matching content type");
        }

        if (content.Length is 0 or > MaximumBytes)
        {
            throw new DomainException("release_import.cover_size_invalid", "Cover must contain image bytes and be 10 MiB or smaller");
        }

        bool valid = extension switch
        {
            ".jpg" or ".jpeg" => content.Length >= 3 && content[0] == 0xff && content[1] == 0xd8 && content[2] == 0xff,
            ".png" => content.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            ".webp" => content.Length >= 12 && content.AsSpan(0, 4).SequenceEqual("RIFF"u8) && content.AsSpan(8, 4).SequenceEqual("WEBP"u8),
            _ => false
        };
        return valid ? extension : throw new DomainException("release_import.cover_format_invalid", "Cover content does not match its image format");
    }
}
