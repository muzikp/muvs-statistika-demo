import { t } from './texts';
import { seededRandom } from './statistics';
import { MAX_POPULATION, MAX_REPEATS, randomIndices } from './sampling';
import { studentCdf, studentQuantile, studentSurvival } from './student';

export type Alternative = 'two-sided' | 'greater' | 'less';
export interface HypothesisSpec { size: number; seed: string; meanA: number; meanB: number; spreadA: number; spreadB: number }
export interface HypothesisConfig { population: HypothesisSpec; nA: number; nB: number; repeats: number; seed: string; alpha: number; nullDifference: number; alternative: Alternative }
export interface DensityPoint { x: number; y: number }
export interface GroupSummary { mean: number; sd: number }
export interface HypothesisPopulationSummary { spec: HypothesisSpec; groups: GroupSummary[]; truth: number; cohensD: number | null }
export interface HypothesisPopulation { summary: HypothesisPopulationSummary; groups: Float64Array[] }
export interface GroupEstimate { mean: number; variance: number; dfDenominator: number; sd: number; effectSd: number }
export interface TestResult { meanA: number; meanB: number; sdA: number; sdB: number; effectSdA: number; effectSdB: number; cohensD: number | null; difference: number; se: number; seA: number; seB: number; df: number; statistic: number; p: number; critical: number; low: number; high: number; outside: boolean; reject: boolean }
export interface HypothesisIteration { iteration: number; result: TestResult | null }
export type HypothesisMessage = ({ type: 'population-progress'; completed: number; total: number } | { type: 'population-ready'; population: HypothesisPopulationSummary } | { type: 'progress' | 'completed'; entries: HypothesisIteration[] } | { type: 'preview-ready'; entry: HypothesisIteration; config: HypothesisConfig; population: HypothesisPopulationSummary } | { type: 'error'; message: string }) & { requestId?: number };
export const DEFAULT_HYPOTHESIS_SPEC: HypothesisSpec = { size: 50000, seed: 'ulohy-2026', meanA: 60, meanB: 60, spreadA: 12, spreadB: 15 };
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
  return errors;
}
export function validateHypothesis(config: HypothesisConfig): string[] {
  const errors = validateHypothesisPopulation(config.population);
  if (![config.nA, config.nB].every(n => Number.isInteger(n) && n >= 20 && n <= 2000 && n <= config.population.size / 5)) errors.push(t('hypothesis.invalidSample'));
  if (!Number.isInteger(config.repeats) || config.repeats < 1 || config.repeats > MAX_REPEATS) errors.push(t('sampling.pocetOpakovaniMusiBytCeleCisloOd1'));
  if (!Number.isFinite(config.alpha) || config.alpha < .001 || config.alpha > .2 || !Number.isFinite(config.nullDifference) || Math.abs(config.nullDifference) > 1000) errors.push(t('hypothesis.invalidTest'));
  if (!['two-sided', 'greater', 'less'].includes(config.alternative)) errors.push(t('hypothesis.invalidMethod'));
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
  const groups: Float64Array[] = [], stats: { mean: number; sd: number }[] = [];
  progress?.(0, 2 * spec.size);
  for (let g = 0; g < 2; g++) {
    const random = seededRandom(`hypothesis:${spec.seed}:${g}`), values = new Float64Array(spec.size);
    const mean = g ? spec.meanB : spec.meanA, spread = g ? spec.spreadB : spec.spreadA;
    const logSd = Math.sqrt(Math.log1p((spread / mean) ** 2)); let sum = 0;
    for (let i = 0; i < spec.size; i++) {
      const normal = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
      values[i] = Math.exp(logSd * normal);
      sum += values[i];
      if ((g * spec.size + i + 1) % 1000 === 0) progress?.(g * spec.size + i + 1, 2 * spec.size);
    }
    // Calibrate each finite population to its chosen mean so H0 can hold exactly.
    const factor = mean * spec.size / sum; let squared = 0;
    for (let i = 0; i < values.length; i++) { values[i] *= factor; squared += (values[i] - mean) ** 2; }
    stats.push({ mean, sd: Math.sqrt(squared / spec.size) }); groups.push(values);
  }
  progress?.(2 * spec.size, 2 * spec.size);
  return { summary: { spec: { ...spec }, groups: stats, truth: populationDifference(spec), cohensD: cohensD(stats[0].mean, stats[1].mean, stats[0].sd, stats[1].sd) }, groups };
}
export function hypothesisNullTrue(truth: number, config: Pick<HypothesisConfig, 'alternative' | 'nullDifference'>): boolean {
  const difference = truth - config.nullDifference;
  return config.alternative === 'greater' ? difference <= 1e-10 : config.alternative === 'less' ? difference >= -1e-10 : Math.abs(difference) <= 1e-10;
}
export function groupEstimate(population: HypothesisPopulation, group: number, ids: number[]): GroupEstimate | null {
  if (ids.length < 2) return null;
  const values = population.groups[group];
  const mean = ids.reduce((sum, id) => sum + values[id], 0) / ids.length;
  const sampleVariance = ids.reduce((sum, id) => sum + (values[id] - mean) ** 2, 0) / (ids.length - 1);
  const variance = sampleVariance / ids.length * (1 - ids.length / values.length);
  return { mean, variance, dfDenominator: variance ** 2 / (ids.length - 1), sd: Math.sqrt(sampleVariance), effectSd: Math.sqrt(sampleVariance) };
}
export function welchResult(a: GroupEstimate, b: GroupEstimate, config: Pick<HypothesisConfig, 'alpha' | 'alternative' | 'nullDifference'>, truth: number): TestResult | null {
  const variance = a.variance + b.variance, denominator = a.dfDenominator + b.dfDenominator;
  if (!(variance > 0) || !(denominator > 0)) return null;
  const difference = b.mean - a.mean, se = Math.sqrt(variance), df = variance ** 2 / denominator, statistic = (difference - config.nullDifference) / se;
  const p = Math.max(0, Math.min(1, config.alternative === 'two-sided' ? 2 * studentSurvival(Math.abs(statistic), df) : config.alternative === 'greater' ? studentSurvival(statistic, df) : studentCdf(statistic, df)));
  const critical = studentQuantile(1 - config.alpha / (config.alternative === 'two-sided' ? 2 : 1), df);
  const low = config.alternative === 'less' ? -Infinity : difference - critical * se;
  const high = config.alternative === 'greater' ? Infinity : difference + critical * se;
  return { meanA: a.mean, meanB: b.mean, sdA: a.sd, sdB: b.sd, effectSdA: a.effectSd, effectSdB: b.effectSd, cohensD: cohensD(a.mean, b.mean, a.effectSd, b.effectSd), difference, se, seA: Math.sqrt(a.variance), seB: Math.sqrt(b.variance), df, statistic, p, critical, low, high, outside: truth < low || truth > high, reject: p < config.alpha };
}
function nestedIndices(size: number, n: number, random: () => number): number[] {
  const ids = new Set<number>();
  while (ids.size < n) ids.add(Math.floor(random() * size));
  return [...ids];
}
export function hypothesisSampler(population: HypothesisPopulation, config: HypothesisConfig, nested = false) {
  return (iteration: number) => {
    const ids = [config.nA, config.nB].map((n, group) => {
      const random = seededRandom(`${config.seed}:random:${group}:${iteration}`);
      return nested ? nestedIndices(population.groups[group].length, n, random) : randomIndices(population.groups[group].length, n, random);
    });
    const estimates = ids.map((sample, g) => groupEstimate(population, g, sample));
    return { entry: { iteration: iteration + 1, result: estimates.every(Boolean) ? welchResult(estimates[0]!, estimates[1]!, config, population.summary.truth) : null } satisfies HypothesisIteration, ids };
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
