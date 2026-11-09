/** Operators the calculator service understands (see CONTEXT.md). */
export type Operator = BinaryOperator | 'percentage'

/** Operators entered between two Operands, which can be pending in the Chain. */
export type BinaryOperator = 'add' | 'subtract' | 'multiply' | 'divide'

/** + and −: the Operators after which % means "percent of the left Operand" (ADR-0002). */
export function isAdditive(operator: BinaryOperator): boolean {
  return operator === 'add' || operator === 'subtract'
}

/** The symbol shown for each Operator on keys and in the Pending Operation line. */
export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  percentage: '%',
}

/** One Operator applied to its Operands; the unit the service evaluates (ADR-0001). */
export interface Operation {
  operation: Operator
  operands: number[]
}

/**
 * An Operator as advertised by the service: its name and how many Operands it takes.
 * `name` is a plain string, not `Operator`: the service may advertise Operators this UI doesn't know.
 */
export interface OperatorInfo {
  name: string
  arity: number
}
