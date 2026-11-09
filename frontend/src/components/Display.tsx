interface DisplayProps {
  /** The Pending Operation, e.g. "12 ÷"; empty when nothing is pending. */
  pendingOperationText: string
  value: string
}

/**
 * Font size step for the value, so even a 15-digit typed number with sign and decimal point,
 * or a 12-digit Result in exponent notation, stays on one line.
 */
function valueSize(value: string): 'large' | 'medium' | 'small' | 'smallest' {
  if (value.length <= 10) return 'large'
  if (value.length <= 13) return 'medium'
  if (value.length <= 17) return 'small'
  return 'smallest'
}

export function Display({ pendingOperationText, value }: DisplayProps) {
  return (
    <div className="display">
      <div className="display__pending" aria-label="pending operation">
        {pendingOperationText}
      </div>
      <output
        className="display__value"
        data-size={valueSize(value)}
        role="status"
        aria-label="display"
        aria-live="polite"
      >
        {value}
      </output>
    </div>
  )
}
