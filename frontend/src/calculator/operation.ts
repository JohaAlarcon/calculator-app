/** Operators the calculator service understands (see CONTEXT.md). */
export type Operator = 'add'

/** One Operator applied to its Operands; the unit the service evaluates (ADR-0001). */
export interface Operation {
  operation: Operator
  operands: number[]
}
