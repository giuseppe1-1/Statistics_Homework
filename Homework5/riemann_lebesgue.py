"""Riemann and Lebesgue sums for smooth functions (the full set, with Dirichlet / Thomae, is in js/integ.js)."""
import math

# name, f, a, b, exact, G(t) = measure{x : f(x) < t}, range lo, hi
FUNCS = {
    "sin x on [0,pi]": (math.sin, 0, math.pi, 2.0, lambda t: 0 if t <= 0 else math.pi if t > 1 else 2 * math.asin(t), 0, 1),
    "x^2 on [0,1]":    (lambda x: x * x, 0, 1, 1 / 3, lambda t: 0 if t <= 0 else 1 if t >= 1 else math.sqrt(t), 0, 1),
    "|x-0.5|":         (lambda x: abs(x - .5), 0, 1, .25, lambda t: 0 if t <= 0 else min(2 * t, 1), 0, .5),
}

def riemann(f, a, b, n, tag="mid"):
    h = (b - a) / n
    off = 0.5 if tag == "mid" else 0.0
    return h * sum(f(a + (i + off) * h) for i in range(n))

def lebesgue(G, a, b, lo, hi, N, mode="mid"):
    d = (hi - lo) / N
    total, g_prev = 0.0, G(lo)
    for k in range(N):
        y0 = lo + k * d
        g_next = (b - a) if k == N - 1 else G(y0 + d)       # last band closed
        y = y0 + (d / 2 if mode == "mid" else 0)
        total += y * (g_next - g_prev); g_prev = g_next
    return total

if __name__ == "__main__":
    for name, (f, a, b, ex, G, lo, hi) in FUNCS.items():
        print(name, "exact", ex)
        for n in (10, 100, 1000, 10000):
            print("  n=%6d  Riemann mid %.2e  Riemann left %.2e  Lebesgue lower %.2e  Lebesgue mid %.2e" % (
                n, abs(riemann(f, a, b, n) - ex), abs(riemann(f, a, b, n, "left") - ex),
                abs(lebesgue(G, a, b, lo, hi, n, "low") - ex), abs(lebesgue(G, a, b, lo, hi, n) - ex)))
