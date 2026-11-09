// Package calculator is the arithmetic domain: it evaluates a single Operation
// (an Operator applied to its Operands) and knows nothing about HTTP.
package calculator

import (
	"errors"
	"fmt"
)

// ErrUnknownOperator is returned when no Operator with the given name exists.
var ErrUnknownOperator = errors.New("unknown operator")

// ErrOperandCount is returned when the number of Operands does not match the Operator's arity.
var ErrOperandCount = errors.New("wrong number of operands")

// operator is a registry entry: how many Operands it takes and how to evaluate them.
type operator struct {
	arity int
	eval  func(operands []float64) float64
}

// registry holds every supported Operator. Adding an Operator is one entry here.
var registry = map[string]operator{
	"add": {arity: 2, eval: func(o []float64) float64 { return o[0] + o[1] }},
}

// Evaluate applies the named Operator to the Operands and returns the Result.
func Evaluate(name string, operands []float64) (float64, error) {
	op, ok := registry[name]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperator, name)
	}
	if len(operands) != op.arity {
		return 0, fmt.Errorf("%w: %q takes %d, got %d", ErrOperandCount, name, op.arity, len(operands))
	}
	return op.eval(operands), nil
}
