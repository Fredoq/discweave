using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Relations;

public static class TrackRelationTypeCode
{
    public const int MaxLength = 64;

    public static string Required(string? code, string parameterName, string requiredErrorCode, string invalidErrorCode)
    {
        string trimmed = Guard.RequiredText(code ?? string.Empty, parameterName, requiredErrorCode);
        if (trimmed.Length > MaxLength)
        {
            throw new DomainException(invalidErrorCode, $"Track relation type code must be at most {MaxLength} characters");
        }

        foreach (char character in trimmed)
        {
            bool isLetterOrDigit = character is (>= 'A' and <= 'Z') or (>= 'a' and <= 'z') or (>= '0' and <= '9');
            if (!isLetterOrDigit && character is not '_' and not '-')
            {
                throw new DomainException(invalidErrorCode, "Track relation type code is invalid");
            }
        }

        return trimmed;
    }
}
