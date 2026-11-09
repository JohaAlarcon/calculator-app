# Calculator

A web calculator whose arithmetic is performed by a stateless backend service, while the user interface drives the sequence of key presses like a pocket calculator.

## Language

**Operation**:
A single arithmetic computation — one Operator applied to its Operands — that yields one Result.
_Avoid_: Calculation, request, expression

**Operator**:
The named arithmetic function of an Operation (add, subtract, multiply, divide, power, sqrt, percentage).
_Avoid_: Op, function, action

**Operand**:
A number an Operator is applied to.
_Avoid_: Argument, input, value

**Result**:
The number produced by an Operation.
_Avoid_: Answer, output, total

**Percentage**:
The Operator yielding a given percent of a base number ("10 percent of 50" is 5). Not the remainder of a division.
_Avoid_: Modulo, mod, percent-change

### Failures

**Math Error**:
A well-formed Operation that has no finite real Result: division by zero, an Operand outside the Operator's domain (e.g. square root of a negative), or a Result too large to represent.
_Avoid_: Calculation error, exception, NaN

**Invalid Request**:
A request that is not a well-formed Operation: unreadable, an unknown Operator, or the wrong number of Operands for the Operator.
_Avoid_: Bad input, validation error, Math Error

### Chains

**Chain**:
The in-progress sequence of Operations the user is building, evaluated strictly left to right, where each Result becomes the left Operand of the next Operation.
_Avoid_: Session, expression, history

**Pending Operation**:
The Operation in a Chain whose Operator and left Operand are known but whose right Operand is still being entered.
_Avoid_: Current op, waiting operator

**Last Operation**:
The most recently completed Operation's Operator and right Operand, re-applied to the current Result when `=` is pressed again.
_Avoid_: Previous step, history
