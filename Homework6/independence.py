"""Chi-square test of independence for a bivariate dataset (X, F), without statistics libraries.

Usage:  python3 independence.py                 # built-in datasets
        python3 independence.py data.csv        # CSV with two columns: x,f (one record per line)
"""
import math, sys, csv
from collections import Counter

# ---- special functions: log-gamma and the chi-square survival function --------------------------
def lgamma(x): return math.lgamma(x)

def gamma_q(a, x):                       # regularised upper incomplete gamma Q(a, x)
    if x <= 0: return 1.0
    if x < a + 1:                        # series for P, then Q = 1 - P
        ap, s = a, 1 / a; d = s
        for _ in range(5000):
            ap += 1; d *= x / ap; s += d
            if abs(d) < abs(s) * 1e-16: break
        return 1 - s * math.exp(-x + a * math.log(x) - lgamma(a))
    tiny = 1e-300; b = x + 1 - a; c = 1 / tiny; d = 1 / b; h = d      # Lentz continued fraction
    for i in range(1, 5000):
        an = -i * (i - a); b += 2; d = an * d + b; d = d if abs(d) > tiny else tiny
        c = b + an / c; c = c if abs(c) > tiny else tiny; d = 1 / d; delta = d * c; h *= delta
        if abs(delta - 1) < 1e-16: break
    return math.exp(-x + a * math.log(x) - lgamma(a)) * h

chi2_sf = lambda x, df: gamma_q(df / 2, x / 2)

# ---- contingency table and test ------------------------------------------------------------------
def contingency(pairs):
    rows = sorted({x for x, _ in pairs}); cols = sorted({f for _, f in pairs}); cnt = Counter(pairs)
    return rows, cols, [[cnt[(x, f)] for f in cols] for x in rows]

def independence_test(O):
    r, c = len(O), len(O[0])
    row = [sum(O[i]) for i in range(r)]; col = [sum(O[i][j] for i in range(r)) for j in range(c)]; n = sum(row)
    E = [[row[i] * col[j] / n for j in range(c)] for i in range(r)]
    chi2 = sum((O[i][j] - E[i][j]) ** 2 / E[i][j] for i in range(r) for j in range(c))
    df = (r - 1) * (c - 1); V = math.sqrt(chi2 / (n * (min(r, c) - 1)))
    return dict(n=n, row=row, col=col, E=E, chi2=chi2, df=df, p=chi2_sf(chi2, df), V=V)

def report(name, rows, cols, O):
    t = independence_test(O); n = t["n"]
    print("=" * 78); print(name)
    print("Observed counts (with marginal totals):")
    print("%-14s" % "" + "".join("%10s" % c for c in cols) + "%10s" % "total")
    for i, r in enumerate(rows): print("%-14s" % r + "".join("%10d" % v for v in O[i]) + "%10d" % t["row"][i])
    print("%-14s" % "total" + "".join("%10d" % v for v in t["col"]) + "%10d" % n)
    print("Marginal relative frequencies  X:", [round(v / n, 3) for v in t["row"]], " F:", [round(v / n, 3) for v in t["col"]])
    print("Conditional frequencies f(F | X):")
    for i, r in enumerate(rows): print("  %-12s" % r, [round(v / t["row"][i], 3) for v in O[i]])
    print("Expected counts under independence:")
    for i, r in enumerate(rows): print("  %-12s" % r, [round(v, 2) for v in t["E"][i]])
    print("chi2 = %.3f   df = %d   p-value = %.3g   Cramer's V = %.3f" % (t["chi2"], t["df"], t["p"], t["V"]))
    print("=> " + ("reject independence at 5%" if t["p"] < 0.05 else "do not reject independence at 5%"))
    try:                                   # optional cross-check
        from scipy.stats import chi2_contingency
        r = chi2_contingency(O, correction=False); print("SciPy: chi2 = %.3f, p = %.3g (difference %.1e)" % (r[0], r[1], abs(r[0] - t["chi2"])))
    except ImportError: pass

DATA = {
    "Hair colour x eye colour (592 students)": (["Black", "Brown", "Red", "Blond"], ["Brown", "Blue", "Hazel", "Green"], [[68, 20, 15, 5], [119, 84, 54, 29], [26, 17, 14, 14], [7, 94, 10, 16]]),
    "Passenger class x survival, Titanic (2201)": (["1st", "2nd", "3rd", "Crew"], ["Died", "Survived"], [[122, 203], [167, 118], [528, 178], [673, 212]]),
    "Gender x admission, UC Berkeley 1973 (4526)": (["Male", "Female"], ["Admitted", "Rejected"], [[1198, 1493], [557, 1278]]),
}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1], newline="") as fh: pairs = [tuple(x.strip() for x in r[:2]) for r in csv.reader(fh) if len(r) >= 2]
        rows, cols, O = contingency(pairs); report(sys.argv[1], rows, cols, O)
    else:
        for name, (rows, cols, O) in DATA.items(): report(name, rows, cols, O)
