"""Welford's recurrence for the running mean, sum of squares (SS) and variance."""


def welford(data):
    k = mean = ss = 0
    for x in data:
        k += 1
        d = x - mean            # 1. difference from the OLD mean
        mean += d / k           # 2. Knuth:   M_k  = M_{k-1} + (x_k - M_{k-1}) / k
        ss += d * (x - mean)    # 3. Welford: SS_k = SS_{k-1} + (x_k - M_{k-1}) * (x_k - M_k)
    variance = ss / (k - 1) if k > 1 else float("nan")   # sample variance (Bessel's correction)
    return k, mean, ss, variance


if __name__ == "__main__":
    import statistics

    data = [2, 4, 4, 4, 5, 5, 7, 9]
    n, mean, ss, var = welford(data)
    print(f"Welford        : n={n} mean={mean} SS={ss} sample variance={var:.6f}")
    print(f"statistics mod.: mean={statistics.mean(data)} sample variance={statistics.variance(data):.6f}")

    # numerical stability: tiny variance on top of a huge offset
    big = [1e9 + x for x in (4, 7, 13, 16)]          # true sample variance = 30
    naive = (sum(x * x for x in big) - sum(big) ** 2 / len(big)) / (len(big) - 1)
    print(f"offset 1e9     : Welford = {welford(big)[3]}   naive sum-of-squares formula = {naive}")
