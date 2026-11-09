interface DisplayProps {
  /** The Pending Operation, e.g. "12 ÷"; empty when nothing is pending. */
  pendingOperationText: string
  value: string
}

export function Display({ pendingOperationText, value }: DisplayProps) {
  return (
    <div className="display">
      <div className="display__pending" aria-label="pending operation">
        {pendingOperationText}
      </div>
      <output className="display__value" role="status" aria-label="display" aria-live="polite">
        {value}
      </output>
    </div>
  )
}
