import type { BatchSummary, CategorySummary, GlobalSummary, PopulationCategory, RealizedCategory, SimulationConfig } from './types';

export const HISTOGRAM_BINS = 40;
export const INTERVAL_LIMIT = 20;
export const LIMITS = { population: 1_000_000, sample: 5_000, categories: 12, batches: 200_000, perBatch: 1_000, totalSamples: 200_000, work: 100_000_000, cells: 2_000_000 };

export function estimateMemory(config: Pick<SimulationConfig, 'N'|'n'|'samplesPerBatch'|'batches'> & { categories: number | PopulationCategory[] }, mode: 'proportion'|'mean' = 'proportion') {
  const populationBytes = mode === 'mean' ? config.N * Float64Array.BYTES_PER_ELEMENT : config.N * 4;
  const sampleBytes = config.samplesPerBatch * config.batches * config.n * (mode === 'mean' ? 8 : 4);
  const categoryCount = typeof config.categories === 'number' ? config.categories : config.categories.length;
  const aggregateBytes = config.batches * categoryCount * (HISTOGRAM_BINS + INTERVAL_LIMIT * 4) * 8;
  return { bytes: populationBytes + sampleBytes + aggregateBytes, populationBytes, aggregateBytes };
}

export function formatBytes(bytes: number) { if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} kB`; if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(2)} GB`; }

export function validate(config: SimulationConfig): string[] {
  const errors: string[] = [];
  const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!integer(config.N, 2, Number.MAX_SAFE_INTEGER)) errors.push('Velikost populace musí být kladné celé číslo.');
  if (!integer(config.n, 1, config.N)) errors.push('Velikost vzorku musí být celé číslo od 1 do N.');
  if (config.n / config.N > 0.05) errors.push('Pro tuto aproximaci musí vzorek tvořit nejvýše 5 % populace (n/N ≤ 0,05).');
  if (!Number.isFinite(config.confidence) || config.confidence < 0.8 || config.confidence > 0.999) errors.push('Spolehlivost musí být od 80 % do 99,9 %.');
  if (!integer(config.samplesPerBatch, 1, Number.MAX_SAFE_INTEGER)) errors.push('Počet opakování musí být kladné celé číslo.');
  if (!integer(config.batches, 1, Number.MAX_SAFE_INTEGER)) errors.push('Počet opakování musí být kladné celé číslo.');
  if (config.categories.length < 2) errors.push('Použijte alespoň 2 kategorie.');
  if (config.categories.some(c => !c.name.trim() || !Number.isFinite(c.weight) || c.weight < 0 || c.weight > 100)) errors.push('Každá kategorie musí mít název a podíl od 0 do 100 %.');
  if (Math.abs(config.categories.reduce((s, c) => s + c.weight, 0) - 100) > 0.0001) errors.push('Součet podílů musí být 100 %. Upravte je nebo použijte normalizaci.');
  if (!['wilson', 'wald'].includes(config.method)) errors.push('Neznámá metoda intervalu.');
  return errors;
}

// Largest remainders; ties follow the original category order.
export function realizePopulation(N: number, categories: PopulationCategory[]): RealizedCategory[] {
  const total = categories.reduce((s, c) => s + c.weight, 0);
  if (!Number.isInteger(N) || N < 1 || total <= 0 || !Number.isFinite(total) || categories.some(c => !Number.isFinite(c.weight) || c.weight < 0)) throw new Error('Neplatná populace.');
  const raw = categories.map(c => N * c.weight / total);
  const counts = raw.map(Math.floor);
  const order = raw.map((value, i) => ({ i, remainder: value - counts[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const remaining = N - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) counts[order[i].i]++;
  return categories.map((c, i) => ({ ...c, count: counts[i], proportion: counts[i] / N }));
}

export function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sequential urn draws are exactly multivariate hypergeometric.
// Only category counts are held; every draw reduces the remaining population.
export function sampleWithoutReplacement(counts: number[], n: number, random: () => number): number[] {
  const remaining = counts.slice();
  let total = counts.reduce((a, b) => a + b, 0);
  if (!Number.isInteger(n) || n < 0 || n > total) throw new Error('Neplatná velikost vzorku.');
  const sample = counts.map(() => 0);
  for (let draw = 0; draw < n; draw++) {
    let position = Math.floor(random() * total);
    for (let k = 0; k < remaining.length; k++) {
      if (position < remaining[k]) { sample[k]++; remaining[k]--; break; }
      position -= remaining[k];
    }
    total--;
  }
  return sample;
}

// Acklam's rational approximation to the inverse standard normal CDF.
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('Pravděpodobnost musí ležet mezi 0 a 1.');
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  if (p < 0.02425 || p > 0.97575) {
    const q = Math.sqrt(-2 * Math.log(p < 0.02425 ? p : 1 - p));
    const value = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    return p < 0.02425 ? value : -value;
  }
  const q = p - 0.5, r = q*q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

export function confidenceInterval(x: number, n: number, z: number, method: SimulationConfig['method']): [number, number] {
  const p = x / n;
  let center = p, width: number;
  if (method === 'wilson') {
    const denominator = 1 + z*z/n;
    center = (p + z*z/(2*n)) / denominator;
    width = z / denominator * Math.sqrt(p*(1-p)/n + z*z/(4*n*n));
  } else width = z * Math.sqrt(p*(1-p)/n);
  return [Math.max(0, center - width), Math.min(1, center + width)];
}
export const isOutside = (p: number, low: number, high: number) => p < low - 1e-12 || p > high + 1e-12;

export function createBatch(index: number, categories: number): BatchSummary {
  return { index, samples: 0, meanOutsidePerSample: 0, categories: Array.from({ length: categories }, (): CategorySummary => ({ outside: 0, sum: 0, min: 1, max: 0, widthSum: 0, histogram: Array(HISTOGRAM_BINS).fill(0), intervals: [] })) };
}
export function addSample(batch: BatchSummary, counts: number[], population: RealizedCategory[], config: SimulationConfig, z: number): void {
  counts.forEach((x, k) => {
    const estimate = x / config.n;
    const [low, high] = confidenceInterval(x, config.n, z, config.method);
    const outside = isOutside(population[k].proportion, low, high);
    const category = batch.categories[k];
    category.outside += Number(outside); category.sum += estimate; category.widthSum += high-low;
    category.min = Math.min(category.min, estimate); category.max = Math.max(category.max, estimate);
    category.histogram[Math.min(HISTOGRAM_BINS - 1, Math.floor(estimate * HISTOGRAM_BINS))]++;
    if (batch.samples < INTERVAL_LIMIT) category.intervals.push({ low, high, estimate, outside });
  });
  batch.samples++;
  batch.meanOutsidePerSample = batch.categories.reduce((s, c) => s + c.outside, 0) / batch.samples;
}
export function createGlobal(categories: number): GlobalSummary {
  return { batches: 0, samples: 0, categories: Array.from({ length: categories }, () => ({ outside: 0, sum: 0, widthSum: 0, min: 1, max: 0 })) };
}
export function mergeBatch(global: GlobalSummary, batch: BatchSummary): void {
  global.batches++; global.samples += batch.samples;
  batch.categories.forEach((c, i) => {
    const g = global.categories[i];
    g.outside += c.outside; g.sum += c.sum; g.widthSum += c.widthSum;
    g.min = Math.min(g.min, c.min); g.max = Math.max(g.max, c.max);
  });
}
