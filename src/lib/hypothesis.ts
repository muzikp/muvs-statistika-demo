import { t } from './texts';
import { seededRandom, realizePopulation } from './statistics';
import { DEFAULT_SHARES, MAX_POPULATION, MAX_REPEATS, randomIndices, stratifiedAllocation, convenienceIndices, type Method } from './sampling';
import { studentCdf, studentQuantile, studentSurvival } from './student';

export type Alternative = 'two-sided' | 'greater' | 'less';
export interface HypothesisSpec { size: number; seed: string; meanA: number; meanB: number; spreadA: number; spreadB: number; shares: number[] }
export interface HypothesisConfig { population: HypothesisSpec; nA: number; nB: number; repeats: number; seed: string; alpha: number; nullDifference: number; alternative: Alternative; method: Method; demographicBias: number; outcomeBias: number }
export interface DensityPoint { x: number; y: number }
export interface GroupSummary { mean: number; sd: number }
export interface HypothesisPopulationSummary { spec: HypothesisSpec; groups: GroupSummary[]; counts: number[]; truth: number; cohensD: number | null }
export interface HypothesisPopulation { summary: HypothesisPopulationSummary; groups: Float64Array[]; cells: number[][]; cellCodes: Uint8Array }
export interface GroupEstimate { mean: number; variance: number; dfDenominator: number; sd: number; effectSd: number; counts: number[]; weights: (number | null)[] }
export interface TestResult { meanA: number; meanB: number; sdA: number; sdB: number; effectSdA: number; effectSdB: number; cohensD: number | null; difference: number; se: number; seA: number; seB: number; df: number; statistic: number; p: number; critical: number; low: number; high: number; outside: boolean; reject: boolean; counts: number[][]; weights: (number | null)[][] }
export interface HypothesisIteration { iteration: number; result: TestResult | null; insufficient: number[][]; sample?: { counts: number[][]; weights: (number | null)[][] } }
export type HypothesisMessage = ({ type: 'population-progress'; completed: number; total: number } | { type: 'population-ready'; population: HypothesisPopulationSummary } | { type: 'progress' | 'completed'; entries: HypothesisIteration[] } | { type: 'preview-ready'; entry: HypothesisIteration; config: HypothesisConfig; population: HypothesisPopulationSummary } | { type: 'error'; message: string }) & { requestId?: number };
export const DEFAULT_HYPOTHESIS_SPEC: HypothesisSpec = { size: 50000, seed: 'ulohy-2026', meanA: 60, meanB: 60, spreadA: 12, spreadB: 15, shares: [...DEFAULT_SHARES] };
export const populationDifference = (spec: HypothesisSpec) => spec.meanB - spec.meanA;

/** B - A standardized by the RMS within-group SD; independent of the sampling ratio. */
export function cohensD(meanA: number, meanB: number, sdA: number, sdB: number): number | null {
  if (![meanA, meanB, sdA, sdB].every(Number.isFinite) || sdA < 0 || sdB < 0) return null;
  const standardizer = Math.sqrt((sdA ** 2 + sdB ** 2) / 2);
  return standardizer > 0 ? (meanB - meanA) / standardizer : null;
}

export function validateHypothesisPopulation(spec: HypothesisSpec): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(spec.size) || spec.size < 10000 || spec.size > MAX_POPULATION) errors.push(t('hypothesis.invalidPopulation'));
  if (![spec.meanA, spec.meanB, spec.spreadA, spec.spreadB].every(Number.isFinite) || spec.meanA < 1 || spec.meanA > 1000 || spec.meanB < 1 || spec.meanB > 1000 || spec.spreadA < 1 || spec.spreadB < 1 || spec.spreadA > 100 || spec.spreadB > 100) errors.push(t('hypothesis.invalidMeans'));
  if (spec.shares.length !== 8 || spec.shares.some(value => !Number.isFinite(value) || value < 2 || value > 60) || Math.abs(spec.shares.reduce((sum, value) => sum + value, 0) - 100) > 1e-7) errors.push(t('hypothesis.invalidShares'));
  return errors;
}
export function validateHypothesis(config: HypothesisConfig): string[] {
  const errors = validateHypothesisPopulation(config.population);
  if (![config.nA, config.nB].every(n => Number.isInteger(n) && n >= 20 && n <= 2000 && n <= config.population.size / 5)) errors.push(t('hypothesis.invalidSample'));
  if (!Number.isInteger(config.repeats) || config.repeats < 1 || config.repeats > MAX_REPEATS) errors.push(t('sampling.pocetOpakovaniMusiBytCeleCisloOd1'));
  if (!Number.isFinite(config.alpha) || config.alpha < .001 || config.alpha > .2 || !Number.isFinite(config.nullDifference) || Math.abs(config.nullDifference) > 1000) errors.push(t('hypothesis.invalidTest'));
  if (!['random', 'stratified', 'convenience', 'weighted'].includes(config.method) || !['two-sided', 'greater', 'less'].includes(config.alternative) || ![config.demographicBias, config.outcomeBias].every(value => Number.isFinite(value) && value >= 0 && value <= 2)) errors.push(t('hypothesis.invalidMethod'));
  return errors;
}

/** Smoothed, normalized empirical density on a shared grid, not a fitted normal curve. */
export function density(values: ArrayLike<number>, domain: [number, number], bandwidth: number): DensityPoint[] {
  const bins = 160, step = (domain[1] - domain[0]) / (bins - 1), counts = new Float64Array(bins);
  for (let i = 0; i < values.length; i++) counts[Math.max(0, Math.min(bins - 1, Math.round((values[i] - domain[0]) / step)))]++;
  const h = Math.max(step, bandwidth), radius = Math.min(bins, Math.ceil(4 * h / step));
  const points = Array.from({ length: bins }, (_, i) => {
    let sum = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(bins - 1, i + radius); j++) sum += counts[j] * Math.exp(-.5 * ((i - j) * step / h) ** 2);
    return { x: domain[0] + i * step, y: sum / Math.max(1, values.length) / h / Math.sqrt(2 * Math.PI) };
  });
  const area = points.reduce((sum, point, i) => sum + point.y * step * (i === 0 || i === bins - 1 ? .5 : 1), 0);
  return points.map(point => ({ x: point.x, y: area > 0 ? point.y / area : 0 }));
}
export function createHypothesisPopulation(spec: HypothesisSpec, progress?: (completed: number, total: number) => void): HypothesisPopulation {
  const errors = validateHypothesisPopulation(spec); if (errors.length) throw Error(errors[0]);
  const counts = realizePopulation(spec.size, spec.shares.map((weight, id) => ({ id, weight, name: '', color: '' }))).map(cell => cell.count);
  const cells: number[][] = counts.map(() => []), cellCodes = new Uint8Array(spec.size);
  let offset = 0;
  counts.forEach((count, cell) => { for (let i = 0; i < count; i++) { cells[cell].push(offset); cellCodes[offset++] = cell; } });
  const groups: Float64Array[] = [], stats: { mean: number; sd: number }[] = [];
  progress?.(0, 2 * spec.size);
  for (let g = 0; g < 2; g++) {
    const random = seededRandom(`hypothesis:${spec.seed}:${g}`), values = new Float64Array(spec.size);
    const mean = g ? spec.meanB : spec.meanA, spread = g ? spec.spreadB : spec.spreadA;
    const logSd = Math.sqrt(Math.log1p((spread / mean) ** 2)); let sum = 0;
    for (let i = 0; i < spec.size; i++) {
      const cell = cellCodes[i], normal = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
      values[i] = Math.exp(logSd * (normal + .24 * (Math.floor(cell / 2) - 1.5) + .12 * (cell % 2)));
      sum += values[i];
      if ((g * spec.size + i + 1) % 1000 === 0) progress?.(g * spec.size + i + 1, 2 * spec.size);
    }
    // Calibrate each finite population to its chosen mean so H0 can hold exactly.
    const factor = mean * spec.size / sum; let squared = 0;
    for (let i = 0; i < values.length; i++) { values[i] *= factor; squared += (values[i] - mean) ** 2; }
    stats.push({ mean, sd: Math.sqrt(squared / spec.size) }); groups.push(values);
  }
  progress?.(2 * spec.size, 2 * spec.size);
  return { summary: { spec: { ...spec, shares: [...spec.shares] }, counts, groups: stats, truth: populationDifference(spec), cohensD: cohensD(stats[0].mean, stats[1].mean, stats[0].sd, stats[1].sd) }, groups, cells, cellCodes };
}
export function hypothesisNullTrue(truth: number, config: Pick<HypothesisConfig, 'alternative' | 'nullDifference'>): boolean {
  const difference = truth - config.nullDifference;
  return config.alternative === 'greater' ? difference <= 1e-10 : config.alternative === 'less' ? difference >= -1e-10 : Math.abs(difference) <= 1e-10;
}
export function groupEstimate(population: HypothesisPopulation, group: number, ids: number[], method: Method): GroupEstimate | null {
  const values = population.groups[group], counts = Array(8).fill(0) as number[], sums = Array(8).fill(0) as number[];
  ids.forEach(id => { const h = population.cellCodes[id]; counts[h]++; sums[h] += values[id]; });
  const grouped = method === 'stratified' || method === 'weighted';
  if (grouped && counts.some(count => count < 2)) return null;
  const weights = counts.map((count, h) => count ? grouped ? population.cells[h].length / values.length / (count / ids.length) : 1 : null);
  const mean = grouped ? sums.reduce((sum, value, h) => sum + population.cells[h].length / values.length * value / counts[h], 0) : sums.reduce((sum, value) => sum + value, 0) / ids.length;
  const squared = Array(8).fill(0) as number[];
  let rawSquared = 0;
  ids.forEach(id => { const h = population.cellCodes[id]; squared[h] += (values[id] - (grouped ? sums[h] / counts[h] : mean)) ** 2; rawSquared += (values[id] - mean) ** 2; });
  let variance = 0, dfDenominator = 0;
  if (grouped) counts.forEach((count, h) => {
    const share = population.cells[h].length / values.length;
    const component = share ** 2 * squared[h] / (count - 1) / count * (method === 'stratified' ? 1 - count / population.cells[h].length : 1);
    variance += component; dfDenominator += component ** 2 / (count - 1);
  });
  else { variance = rawSquared / (ids.length - 1) / ids.length * (method === 'random' ? 1 - ids.length / values.length : 1); dfDenominator = variance ** 2 / (ids.length - 1); }
  // A weighted mean must be standardized by the same target demographic mixture,
  // retaining both within-cell variation and variation between cell means.
  const effectVariance = grouped ? counts.reduce((sum, count, h) => sum + population.cells[h].length / values.length * (squared[h] / (count - 1) + (sums[h] / count - mean) ** 2), 0) : rawSquared / (ids.length - 1);
  return { mean, variance, dfDenominator, sd: Math.sqrt(rawSquared / (ids.length - 1)), effectSd: Math.sqrt(effectVariance), counts, weights };
}
export function welchResult(a: GroupEstimate, b: GroupEstimate, config: Pick<HypothesisConfig, 'alpha' | 'alternative' | 'nullDifference'>, truth: number): TestResult | null {
  const variance = a.variance + b.variance, denominator = a.dfDenominator + b.dfDenominator;
  if (!(variance > 0) || !(denominator > 0)) return null;
  const difference = b.mean - a.mean, se = Math.sqrt(variance), df = variance ** 2 / denominator, statistic = (difference - config.nullDifference) / se;
  const p = Math.max(0, Math.min(1, config.alternative === 'two-sided' ? 2 * studentSurvival(Math.abs(statistic), df) : config.alternative === 'greater' ? studentSurvival(statistic, df) : studentCdf(statistic, df)));
  const critical = studentQuantile(1 - config.alpha / (config.alternative === 'two-sided' ? 2 : 1), df);
  const low = config.alternative === 'less' ? -Infinity : difference - critical * se;
  const high = config.alternative === 'greater' ? Infinity : difference + critical * se;
  return { meanA: a.mean, meanB: b.mean, sdA: a.sd, sdB: b.sd, effectSdA: a.effectSd, effectSdB: b.effectSd, cohensD: cohensD(a.mean, b.mean, a.effectSd, b.effectSd), difference, se, seA: Math.sqrt(a.variance), seB: Math.sqrt(b.variance), df, statistic, p, critical, low, high, outside: truth < low || truth > high, reject: p < config.alpha, counts: [a.counts, b.counts], weights: [a.weights, b.weights] };
}
function nestedIndices(size: number, n: number, random: () => number): number[] {
  const ids = new Set<number>();
  while (ids.size < n) ids.add(Math.floor(random() * size));
  return [...ids];
}
export function hypothesisSampler(population: HypothesisPopulation, config: HypothesisConfig, nested = false) {
  const sizes = population.cells.map(cell => cell.length), ns = [config.nA, config.nB];
  const allocations = config.method === 'stratified' ? ns.map(n => stratifiedAllocation(sizes, n)) : [];
  const cdfs = config.method === 'convenience' || config.method === 'weighted' ? population.groups.map((values, group) => {
    const cdf = new Float64Array(values.length); let sum = 0;
    for (let i = 0; i < values.length; i++) { const cell = population.cellCodes[i]; sum += Math.exp(config.demographicBias * (-.55 * Math.floor(cell / 2) - .22 * (cell % 2)) + config.outcomeBias * Math.max(-4, Math.min(4, (values[i] - population.summary.groups[group].mean) / population.summary.groups[group].sd)) * .5); cdf[i] = sum; }
    return cdf;
  }) : [];
  return (iteration: number) => {
    const ids = ns.map((n, group) => {
      const stream = config.method === 'weighted' ? 'convenience' : config.method;
      const random = seededRandom(`${config.seed}:${stream}:${group}:${iteration}`);
      if (config.method === 'random') return nested ? nestedIndices(config.population.size, n, random) : randomIndices(config.population.size, n, random);
      if (config.method === 'stratified') return population.cells.flatMap((cell, h) => (nested ? nestedIndices(cell.length, allocations[group][h], seededRandom(`${config.seed}:${stream}:${group}:${iteration}:${h}`)) : randomIndices(cell.length, allocations[group][h], random)).map(i => cell[i]));
      return convenienceIndices(cdfs[group], n, random);
    });
    const estimates = ids.map((sample, g) => groupEstimate(population, g, sample, config.method));
    const counts = ids.map(sample => { const counts = Array(8).fill(0) as number[]; sample.forEach(id => counts[population.cellCodes[id]]++); return counts; });
    const grouped = config.method === 'weighted' || config.method === 'stratified';
    const insufficient = counts.map(group => grouped ? group.flatMap((count, h) => count < 2 ? [h] : []) : []);
    const weights = counts.map((group, g) => group.map((count, h) => count ? grouped ? population.cells[h].length / population.summary.spec.size / (count / ns[g]) : 1 : null));
    return { entry: { iteration: iteration + 1, result: estimates.every(Boolean) ? welchResult(estimates[0]!, estimates[1]!, config, population.summary.truth) : null, insufficient, sample: { counts, weights } } satisfies HypothesisIteration, ids };
  };
}
export function hypothesisConvergence(history: HypothesisIteration[], config: HypothesisConfig) {
  let valid = 0, missed = 0, wrong = 0, rejected = 0, sum = 0, sumA = 0, sumB = 0, sumD = 0, countD = 0;
  const interval: DensityPoint[] = [], decision: DensityPoint[] = [], nullTrue = hypothesisNullTrue(populationDifference(config.population), config);
  for (const entry of history) {
    if (entry.result) { valid++; missed += Number(entry.result.outside); rejected += Number(entry.result.reject); wrong += Number(entry.result.reject === nullTrue); sum += entry.result.difference; }
    if (entry.result) { sumA += entry.result.meanA; sumB += entry.result.meanB; if (entry.result.cohensD !== null) { sumD += entry.result.cohensD; countD++; } }
    if (valid) { interval.push({ x: entry.iteration, y: missed / valid * 100 }); decision.push({ x: entry.iteration, y: wrong / valid * 100 }); }
  }
  return { interval, decision, valid, skipped: history.length - valid, missed, wrong, rejected, average: valid ? sum / valid : null, averageA: valid ? sumA / valid : null, averageB: valid ? sumB / valid : null, averageD: countD ? sumD / countD : null, countD, nullTrue };
}
