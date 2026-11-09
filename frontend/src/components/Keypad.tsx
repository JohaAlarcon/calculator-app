import { OPERATOR_SYMBOLS, type BinaryOperator, type Operator } from '../calculator/operation'

interface KeypadProps {
  /** Locks every key while an Operation is in flight. */
  locked: boolean
  isAvailable: (operator: Operator) => boolean
  onDigit: (digit: string) => void
  onDecimalPoint: () => void
  onToggleSign: () => void
  onBackspace: () => void
  onOperator: (operator: BinaryOperator) => void
  onPercent: () => void
  onSquareRoot: () => void
  onEquals: () => void
  onClear: () => void
}

const UNAVAILABLE_HINT = 'Not supported by the calculator service'

/**
 * Static keypad (spec #1), four columns; C spans two columns, = spans the last two rows:
 *
 *   C  C  ⌫  ÷
 *   √  xʸ %  ×
 *   7  8  9  −
 *   4  5  6  +
 *   1  2  3  =
 *   ±  0  .  =
 */
export function Keypad(props: KeypadProps) {
  const { locked, isAvailable, onDigit, onDecimalPoint, onToggleSign, onBackspace } = props
  const { onOperator, onPercent, onSquareRoot, onEquals, onClear } = props
  const digit = (d: string) => (
    <button type="button" className="key key--digit" onClick={() => onDigit(d)}>
      {d}
    </button>
  )
  const operatorKey = (o: BinaryOperator) => (
    <OperatorKey operator={o} className="key key--operator" isAvailable={isAvailable} onPress={() => onOperator(o)} />
  )

  return (
    // A disabled fieldset disables every key inside it.
    <fieldset className="keypad" aria-label="Keypad" disabled={locked}>
      <button type="button" className="key key--function key--wide" aria-label="clear" onClick={onClear}>
        C
      </button>
      <button type="button" className="key key--function" aria-label="backspace" onClick={onBackspace}>
        ⌫
      </button>
      {operatorKey('divide')}
      <OperatorKey
        operator="sqrt"
        label="square root"
        className="key key--function"
        isAvailable={isAvailable}
        onPress={onSquareRoot}
      />
      <OperatorKey
        operator="power"
        symbol="xʸ"
        className="key key--function"
        isAvailable={isAvailable}
        onPress={() => onOperator('power')}
      />
      <OperatorKey
        operator="percentage"
        label="percent"
        className="key key--function"
        isAvailable={isAvailable}
        onPress={onPercent}
      />
      {operatorKey('multiply')}
      {digit('7')}
      {digit('8')}
      {digit('9')}
      {operatorKey('subtract')}
      {digit('4')}
      {digit('5')}
      {digit('6')}
      {operatorKey('add')}
      {digit('1')}
      {digit('2')}
      {digit('3')}
      <button type="button" className="key key--equals key--tall" aria-label="equals" onClick={onEquals}>
        =
      </button>
      <button type="button" className="key key--function" aria-label="toggle sign" onClick={onToggleSign}>
        ±
      </button>
      {digit('0')}
      <button type="button" className="key key--digit" aria-label="decimal point" onClick={onDecimalPoint}>
        .
      </button>
    </fieldset>
  )
}

interface OperatorKeyProps {
  /** The service Operator this key needs; the key is marked unavailable if the service doesn't list it. */
  operator: Operator
  /** Accessible name; defaults to the Operator's name. */
  label?: string
  /** What the key shows; defaults to the Operator's symbol. */
  symbol?: string
  className: string
  isAvailable: (operator: Operator) => boolean
  onPress: () => void
}

function OperatorKey({ operator, label = operator, symbol, className, isAvailable, onPress }: OperatorKeyProps) {
  const available = isAvailable(operator)
  // aria-disabled (not disabled) keeps the key focusable, so keyboard and screen-reader users
  // can still reach the explanation of why it is unavailable; the title is both the mouse
  // tooltip and the accessible description.
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-disabled={available ? undefined : true}
      title={available ? undefined : UNAVAILABLE_HINT}
      onClick={available ? onPress : undefined}
    >
      {symbol ?? OPERATOR_SYMBOLS[operator]}
    </button>
  )
}
