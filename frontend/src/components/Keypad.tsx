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
  onEquals: () => void
  onClear: () => void
}

/** Static keypad (spec #1); rows of four, binary Operators down the right-hand column. */
export function Keypad(props: KeypadProps) {
  const { locked, isAvailable, onDigit, onDecimalPoint, onToggleSign, onBackspace, onOperator, onPercent, onEquals, onClear } =
    props
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
    <fieldset className="keypad" disabled={locked}>
      <button type="button" className="key key--function" aria-label="clear" onClick={onClear}>
        C
      </button>
      <button type="button" className="key key--function" aria-label="backspace" onClick={onBackspace}>
        ⌫
      </button>
      <OperatorKey
        operator="percentage"
        label="percent"
        className="key key--function"
        isAvailable={isAvailable}
        onPress={onPercent}
      />
      {operatorKey('divide')}
      {digit('7')}
      {digit('8')}
      {digit('9')}
      {operatorKey('multiply')}
      {digit('4')}
      {digit('5')}
      {digit('6')}
      {operatorKey('subtract')}
      {digit('1')}
      {digit('2')}
      {digit('3')}
      {operatorKey('add')}
      <button type="button" className="key key--function" aria-label="toggle sign" onClick={onToggleSign}>
        ±
      </button>
      {digit('0')}
      <button type="button" className="key key--digit" aria-label="decimal point" onClick={onDecimalPoint}>
        .
      </button>
      <button type="button" className="key key--equals" aria-label="equals" onClick={onEquals}>
        =
      </button>
    </fieldset>
  )
}

interface OperatorKeyProps {
  /** The service Operator this key needs; the key is disabled if the service doesn't list it. */
  operator: Operator
  /** Accessible name; defaults to the Operator's name. */
  label?: string
  className: string
  isAvailable: (operator: Operator) => boolean
  onPress: () => void
}

function OperatorKey({ operator, label = operator, className, isAvailable, onPress }: OperatorKeyProps) {
  const available = isAvailable(operator)
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={!available}
      title={available ? undefined : 'Not supported by the calculator service'}
      onClick={onPress}
    >
      {OPERATOR_SYMBOLS[operator]}
    </button>
  )
}
