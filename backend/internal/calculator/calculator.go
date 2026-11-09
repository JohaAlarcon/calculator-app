// Package calculator is the arithmetic domain: it evaluates a single Operation
// (an Operator applied to its Operands) and knows nothing about HTTP.
package calculator

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"slices"
)

// UnknownOperatorError is returned when no Operator with the given name exists.
type UnknownOperatorError struct {
	Operator string
}

func (e *UnknownOperatorError) Error() string { return fmt.Sprintf("unknown operator %q", e.Operator) }

// OperandCountError is returned when the number of Operands does not match the Operator's arity.
type OperandCountError struct {
	Operator  string
	Want, Got int
}

func (e *OperandCountError) Error() string {
	return fmt.Sprintf("operator %q takes %d operands, got %d", e.Operator, e.Want, e.Got)
}

// Math Errors: a well-formed Operation with no finite real Result (ADR-0004).
var (
	// ErrDivisionByZero is returned when an Operation would divide by zero.
	ErrDivisionByZero = errors.New("division by zero")
	// ErrInvalidOperand is returned when an Operand is outside the Operator's domain
	// (the Result would not be a real number).
	ErrInvalidOperand = errors.New("operand outside the operator's domain")
	// ErrOverflow is returned when the Result is too large to represent.
	ErrOverflow = errors.New("result too large")
)

// operator is a registry entry: how many Operands it takes, an optional domain
// check that reports a Math Error before evaluating, and how to evaluate them.
type operator struct {
	arity int
	check func(operands []float64) error
	eval  func(operands []float64) float64
}

// registry holds every supported Operator. Adding an Operator is one entry here.
var registry = map[string]operator{
	"add":      {arity: 2, eval: func(o []float64) float64 { return o[0] + o[1] }},
	"subtract": {arity: 2, eval: func(o []float64) float64 { return o[0] - o[1] }},
	"multiply": {arity: 2, eval: func(o []float64) float64 { return o[0] * o[1] }},
	"divide":   {arity: 2, check: nonZeroDivisor, eval: func(o []float64) float64 { return o[0] / o[1] }},
}

func nonZeroDivisor(o []float64) error {
	if o[1] == 0 {
		return ErrDivisionByZero
	}
	return nil
}

// Evaluate applies the named Operator to the Operands and returns the Result.
// It never returns a non-finite Result: NaN becomes ErrInvalidOperand and
// ±Inf becomes ErrOverflow, unless the Operator's own check reported a more
// specific Math Error first.
func Evaluate(name string, operands []float64) (float64, error) {
	op, ok := registry[name]
	if !ok {
		return 0, &UnknownOperatorError{Operator: name}
	}
	if len(operands) != op.arity {
		return 0, &OperandCountError{Operator: name, Want: op.arity, Got: len(operands)}
	}
	if op.check != nil {
		if err := op.check(operands); err != nil {
			return 0, err
		}
	}
	result := op.eval(operands)
	switch {
	case math.IsNaN(result):
		return 0, ErrInvalidOperand
	case math.IsInf(result, 0):
		return 0, ErrOverflow
	}
	return result, nil
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
