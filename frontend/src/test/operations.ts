import type { Operation } from '../calculator/operation'

/** Builds a binary Operation, e.g. operation('add', 2, 3). */
export function operation(operator: Operation['operation'], a: number, b: number): Operation {
  return { operation: operator, operands: [a, b] }
}

/** A RegExp matching exactly this text, for toHaveTextContent. */
export function exactly(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&')}$`)
}
