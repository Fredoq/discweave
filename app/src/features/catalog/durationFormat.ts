export function formatDurationSeconds(
  durationSeconds: number | null | undefined,
) {
  if (!durationSeconds || durationSeconds < 1) {
    return 'Unknown duration'
  }

  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = String(durationSeconds % 60).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
  }

  return `${minutes}:${seconds}`
}

export function parseDurationText(value: string) {
  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  const minuteSecondMatch = /^(\d+):([0-5]\d)$/.exec(trimmed)
  if (minuteSecondMatch) {
    const totalSeconds =
      Number.parseInt(minuteSecondMatch[1], 10) * 60 +
      Number.parseInt(minuteSecondMatch[2], 10)

    return totalSeconds > 0 ? totalSeconds : null
  }

  const hourMinuteSecondMatch = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(trimmed)
  if (hourMinuteSecondMatch) {
    const totalSeconds =
      Number.parseInt(hourMinuteSecondMatch[1], 10) * 3600 +
      Number.parseInt(hourMinuteSecondMatch[2], 10) * 60 +
      Number.parseInt(hourMinuteSecondMatch[3], 10)

    return totalSeconds > 0 ? totalSeconds : null
  }

  return null
}

export function hasInvalidDurationText(value: string) {
  return value.trim().length > 0 && parseDurationText(value) === null
}

export type DurationParts = {
  hours: string
  minutes: string
  seconds: string
}

export const emptyDurationParts: DurationParts = {
  hours: '',
  minutes: '',
  seconds: '',
}

export function durationTextToParts(value: string): DurationParts {
  const seconds = parseDurationText(value)
  if (seconds === null) {
    return emptyDurationParts
  }

  return durationSecondsToParts(seconds)
}

export function durationSecondsToParts(totalSeconds: number): DurationParts {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 1) {
    return emptyDurationParts
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours: hours > 0 ? String(hours) : '',
    minutes: minutes > 0 ? String(minutes) : '',
    seconds: seconds > 0 ? String(seconds) : '',
  }
}

export function durationPartsToText(parts: DurationParts) {
  const hours = durationPartValue(parts.hours)
  const minutes = durationPartValue(parts.minutes)
  const seconds = durationPartValue(parts.seconds)
  const totalSeconds = hours * 3600 + minutes * 60 + seconds

  return totalSeconds > 0 ? formatDurationSeconds(totalSeconds) : ''
}

export function normalizeDurationPart(value: string, max: number) {
  if (!/^\d*$/.test(value)) {
    return null
  }

  if (value.length === 0) {
    return ''
  }

  return String(Math.min(Number.parseInt(value, 10), max))
}

function durationPartValue(value: string) {
  const parsed = Number.parseInt(value, 10)

  return Number.isInteger(parsed) ? parsed : 0
}
