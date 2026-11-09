interface DisplayProps {
  value: string
}

export function Display({ value }: DisplayProps) {
  return (
    <output className="display" role="status" aria-label="display" aria-live="polite">
      {value}
    </output>
  )
}
