// Package calculator is the arithmetic domain: it evaluates a single Operation
// (an Operator applied to its Operands) and knows nothing about HTTP.
package calculator

import (
	"cmp"
	"errors"
	"fmt"
	"slices"
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
	"add":      {arity: 2, eval: func(o []float64) float64 { return o[0] + o[1] }},
	"subtract": {arity: 2, eval: func(o []float64) float64 { return o[0] - o[1] }},
	"multiply": {arity: 2, eval: func(o []float64) float64 { return o[0] * o[1] }},
	// Division by zero becomes a Math Error in #6; until then the non-finite
	// Result is caught by the API layer and answered with a 500.
	"divide": {arity: 2, eval: func(o []float64) float64 { return o[0] / o[1] }},
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

// OperatorInfo describes a supported Operator as advertised to clients: its name and
// how many Operands it takes. Name is a plain string because clients may receive
// Operators they don't know yet (the frontend's drift check relies on that).
type OperatorInfo struct {
	Name  string `json:"name"`
	Arity int    `json:"arity"`
}

// Operators lists every supported Operator, sorted by name, straight from the registry.
func Operators() []OperatorInfo {
	infos := make([]OperatorInfo, 0, len(registry))
	for name, entry := range registry {
		infos = append(infos, OperatorInfo{Name: name, Arity: entry.arity})
	}
	slices.SortFunc(infos, func(a, b OperatorInfo) int { return cmp.Compare(a.Name, b.Name) })
	return infos
}
