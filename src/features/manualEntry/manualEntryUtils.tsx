export function createManualRecordId(prefix: string, value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
