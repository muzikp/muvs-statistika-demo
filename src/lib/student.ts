// Student distribution through the regularized incomplete beta function.
const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
export function logGamma(z: number): number {
  if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z--; let sum = .9999999999998099;
  coefficients.forEach((coefficient, i) => { sum += coefficient / (z + i + 1); });
  const x = z + 7.5;
  return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(x) - x + Math.log(sum);
}
function betaFraction(a: number, b: number, x: number) {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < tiny ? tiny : d);
  let result = d;
  for (let m = 1; m <= 200; m++) {
    for (const factor of [m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m)), -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1))]) {
      d = 1 + factor * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + factor / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; const delta = c * d; result *= delta;
      if (factor < 0 && Math.abs(delta - 1) < 3e-14) return result;
    }
  }
  return result;
}
function beta(x: number, a: number, b: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2) ? front * betaFraction(a, b, x) / a : 1 - front * betaFraction(b, a, 1 - x) / b;
}
export function studentSurvival(value: number, df: number): number {
  if (!(df > 0) || Number.isNaN(value)) return NaN;
  const tail = .5 * beta(df / (df + value * value), df / 2, .5);
  return value >= 0 ? tail : 1 - tail;
}
export const studentCdf = (value: number, df: number) => studentSurvival(-value, df);
export function studentDensity(value: number, df: number): number {
  return Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2) - .5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log1p(value * value / df));
}
export function studentQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  if (p < .5) return -studentQuantile(1 - p, df);
  let low = 0, high = 1;
  while (studentSurvival(high, df) > 1 - p) high *= 2;
  for (let i = 0; i < 45; i++) { const middle = (low + high) / 2; if (studentSurvival(middle, df) > 1 - p) low = middle; else high = middle; }
  return (low + high) / 2;
}
