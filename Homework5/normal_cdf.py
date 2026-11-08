"""Standard normal CDF: several numerical methods compared with math.erfc / mpmath."""
import math, time

INV = 1 / math.sqrt(2 * math.pi)
phi = lambda x: INV * math.exp(-0.5 * x * x)

def trapezoid(x, n=1000):
    h = abs(x) / n
    s = 0.5 * (phi(0) + phi(abs(x))) + sum(phi(i * h) for i in range(1, n))
    return 0.5 + math.copysign(s * h, x)

def simpson(x, n=1000):
    n += n % 2
    h = abs(x) / n
    s = phi(0) + phi(abs(x)) + sum((4 if i % 2 else 2) * phi(i * h) for i in range(1, n))
    return 0.5 + math.copysign(s * h / 3, x)

def erf_series(x):                      # alternating Maclaurin series of erf
    z = x / math.sqrt(2); term = s = z; k = 0
    while k < 2000:
        k += 1; term *= -z * z / k; t = term / (2 * k + 1); s += t
        if k > z * z and abs(t) < 1e-17 * abs(s): break
    return 0.5 * (1 + 2 / math.sqrt(math.pi) * s)

def pos_series(x):                      # Phi = 1/2 + phi(x) sum x^(2k+1)/(2k+1)!!
    term = s = x; k = 0
    while k < 5000:
        k += 1; term *= x * x / (2 * k + 1); s += term
        if k > x * x / 2 and abs(term) < 1e-17 * abs(s): break
    return 0.5 + phi(x) * s

def upper_tail(x):                      # Q(x), x > 0: Lentz continued fraction
    f = C = x; D = 0.0
    for k in range(1, 3000):
        D = 1 / (x + k * D); C = x + k / C; d = C * D; f *= d
        if abs(d - 1) < 1e-16: break
    return phi(x) / f

def hybrid(x):                          # the recommended method
    if x >= 0: return pos_series(x) if x < 3 else 1 - upper_tail(x)
    return pos_series(x) if x > -1.5 else upper_tail(-x)

def as_7126(x):                         # Abramowitz & Stegun 7.1.26
    z = abs(x) / math.sqrt(2); t = 1 / (1 + 0.3275911 * z)
    p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    q = 0.5 * p * math.exp(-z * z)
    return 1 - q if x >= 0 else q

def reference(x):                       # libm erfc, or mpmath if installed
    try:
        import mpmath; mpmath.mp.dps = 50; return float(mpmath.ncdf(x))
    except ImportError:
        return 0.5 * math.erfc(-x / math.sqrt(2))

if __name__ == "__main__":
    methods = [("trapezoid", trapezoid), ("simpson", simpson), ("erf series", erf_series), ("pos. series", pos_series),
               ("A&S 7.1.26", as_7126), ("hybrid", hybrid)]
    print("%6s %22s " % ("x", "reference") + " ".join("%11s" % m for m, _ in methods))
    for x in [-6, -3, -1, 0.5, 1, 1.96, 3, 5, 8]:
        r = reference(x)
        print("%6s %22.15g " % (x, r) + " ".join("%11.1e" % (abs(f(x) - r) / r) for _, f in methods))
    xs = [-6 + 12 * i / 20000 for i in range(20000)]
    for name, f in methods + [("math.erfc", lambda x: 0.5 * math.erfc(-x / math.sqrt(2)))]:
        t = time.perf_counter(); [f(x) for x in xs]; print("%-12s %7.1f ms / 20000 evaluations" % (name, 1000 * (time.perf_counter() - t)))
