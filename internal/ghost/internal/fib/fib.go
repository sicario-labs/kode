
package fib

import "errors"

var cache = map[int]int{}

// Compute returns the nth Fibonacci number with memoization.
// Returns an error if n is negative.
func Compute(n int) (int, error) {
	if n < 0 {
		return 0, errors.New("fib: n must be non-negative")
	}
	if n <= 1 {
		return n, nil
	}
	if val, ok := cache[n]; ok {
		return val, nil
	}
	// Iteratively compute up to n, caching intermediate results.
	a, b := 0, 1
	for i := 2; i <= n; i++ {
		next := a + b
		cache[i] = next
		a, b = b, next
	}
	return cache[n], nil
}
