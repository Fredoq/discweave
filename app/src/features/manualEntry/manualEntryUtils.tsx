export function createManualRecordId(prefix: string, value: string) {
  let slug = ''
  let pendingSeparator = false
  for (const character of value.trim().toLowerCase()) {
    const isAsciiLetter = character >= 'a' && character <= 'z'
    const isDigit = character >= '0' && character <= '9'
    if (isAsciiLetter || isDigit) {
      if (pendingSeparator && slug.length > 0) {
        slug += '-'
      }
      slug += character
      pendingSeparator = false
    } else if (slug.length > 0) {
      pendingSeparator = true
    }
  }
  const randomSuffix = crypto.randomUUID()

  return `manual-${prefix}-${slug || 'record'}-${randomSuffix}`
}

export function isManualSessionRecord(recordId: string) {
  return recordId.startsWith('manual-')
}

export function splitCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function textOrFallback(value: string, fallback: string) {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : fallback
}
