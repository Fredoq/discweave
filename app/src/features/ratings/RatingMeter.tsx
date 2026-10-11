import { Sparkles } from 'lucide-react'
import { type CSSProperties, useEffect, useRef } from 'react'
import './rating-meter.css'
import { ratingLabel, ratingStepFill, ratingSteps } from './ratingUtils'

function barStyle(value: number | undefined, step: number) {
  return { '--fill': ratingStepFill(value, step) } as CSSProperties
}

function meterClassName(base: string, standout: boolean, computed = false) {
  return [base, standout ? 'is-standout' : '', computed ? 'is-computed' : '']
    .filter(Boolean)
    .join(' ')
}

/** Read-only level meter: five rising bars, gold when standout, muted when computed. */
export function RatingMeter({
  computed = false,
  label,
  standout = false,
  value,
}: Readonly<{
  computed?: boolean
  label?: string
  standout?: boolean
  value?: number
}>) {
  return (
    <span
      aria-label={label ?? ratingLabel(value, standout)}
      className={meterClassName('rating-meter', standout, computed)}
      role="img"
    >
      {ratingSteps.map((step) => (
        <span
          className="rating-meter-bar"
          key={step}
          style={barStyle(value, step)}
        />
      ))}
      {standout ? (
        <Sparkles aria-hidden="true" className="rating-meter-spark" size={12} />
      ) : null}
    </span>
  )
}

/** Clickable level meter. Clicking the fifth bar again toggles the standout mark. */
export function RatingMeterInput({
  ariaLabel,
  compact = false,
  disabled = false,
  standout = false,
  value,
  onRate,
}: Readonly<{
  ariaLabel: string
  compact?: boolean
  disabled?: boolean
  standout?: boolean
  value?: number
  onRate: (value: number, standout: boolean) => void
}>) {
  // Saving is asynchronous, so a quick second click must see the first one.
  const latest = useRef({ value, standout })
  useEffect(() => {
    latest.current = { value, standout }
  }, [value, standout])

  function rate(step: number) {
    const current = latest.current
    const nextStandout = step === 5 && current.value === 5 && !current.standout
    latest.current = { value: step, standout: nextStandout }
    onRate(step, nextStandout)
  }

  return (
    <fieldset
      aria-label={ariaLabel}
      className={meterClassName(
        compact ? 'rating-meter-input is-compact' : 'rating-meter-input',
        standout,
      )}
    >
      <legend className="visually-hidden">{ariaLabel}</legend>
      {ratingSteps.map((step) => (
        <button
          aria-label={String(step)}
          aria-pressed={value === step}
          className="rating-meter-step"
          disabled={disabled}
          key={step}
          title={
            step === 5 && value === 5
              ? 'Click again to toggle standout'
              : undefined
          }
          type="button"
          onClick={() => rate(step)}
        >
          <span className="rating-meter-bar" style={barStyle(value, step)} />
        </button>
      ))}
      {standout ? (
        <Sparkles aria-hidden="true" className="rating-meter-spark" size={12} />
      ) : null}
    </fieldset>
  )
}
