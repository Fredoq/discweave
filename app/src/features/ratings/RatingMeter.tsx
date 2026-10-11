import { Sparkles } from 'lucide-react'
import type { CSSProperties } from 'react'
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
          onClick={() => onRate(step, step === 5 && value === 5 && !standout)}
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
