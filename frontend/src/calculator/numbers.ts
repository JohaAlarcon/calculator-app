/**
 * Most significant digits a typed Operand may have. float64 represents every decimal with up to
 * 15 significant digits exactly, so a longer entry would be silently rounded by the service.
 */
export const MAX_ENTRY_SIGNIFICANT_DIGITS = 15

/**
 * Longest a typed entry may be, in characters: a sign, "0.", zeros after the point and 15
 * significant digits. Zeros right after the point aren't significant, so without this cap they
 * could grow without limit and stop fitting the display.
 */
export const MAX_ENTRY_LENGTH = 21

/** Significant digits in a typed entry: its digits without the sign, the decimal point or leading zeros. */
export function significantDigits(entry: string): number {
  return entry.replace(/[^0-9]/g, '').replace(/^0+/, '').length
}

/** Most significant digits a Result is shown with; hides float64 noise such as 0.30000000000000004. */
export const MAX_RESULT_SIGNIFICANT_DIGITS = 12

/**
 * How a Result is shown: at most 12 significant digits, trailing zeros dropped, exponent notation
 * for very large or very small magnitudes (as toPrecision decides: ≥ 1e12 or < 1e-6), never "-0".
 * Display only — the Chain keeps calculating with the raw Result.
 */
export function formatResult(result: number): string {
  if (result === 0) return '0'
  const [mantissa, exponent] = result.toPrecision(MAX_RESULT_SIGNIFICANT_DIGITS).split('e')
  const trimmed = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa
  return exponent === undefined ? trimmed : `${trimmed}e${exponent}`
}

/** How a typed Operand is shown once it is no longer being typed: normalised ("5." → "5", "-0" → "0"). */
export function formatTypedOperand(operand: number): string {
  return String(operand === 0 ? 0 : operand)
}
