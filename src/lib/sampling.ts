import { t, dictionary } from './texts';
import { isOutside, normalQuantile, realizePopulation, seededRandom } from './statistics';
import type { Interval } from './types';

export const AGE_GROUPS = dictionary.populationLabels.ageGroups;
export const SEXES = dictionary.populationLabels.sexes;
export const EDUCATION = dictionary.populationLabels.education;
export const PHONES = dictionary.populationLabels.phones;
export const DEFAULT_SHARES = [10, 10, 14, 14, 13, 13, 14, 12];
export const MAX_POPULATION = 1_000_000;
export const MAX_REPEATS = 10_000;
export const METHODS = [
  { id: 'random', name: t('sampling.nahodnyVyber'), color: '#397ec1', description: t('sampling.stejnaSanceProKazdehoClovekaVyberBezVraceni') },
  { id: 'stratified', name: t('sampling.stratifikovanyVyber'), color: '#6b86b5', description: t('sampling.nahodnyVyberUvnitrVekuPohlaviPriblizneUmernyVelikosti') },
  { id: 'convenience', name: t('sampling.prilezitostnyVyber'), color: '#c34e4e', description: t('sampling.mladsiLideAZenyJsouDostupnejsiVolitelneCasteji') },
  { id: 'weighted', name: t('sampling.prilezitostnyVazeni'), color: '#6b86b5', description: t('sampling.presneTentyzPrilezitostnyVzorekPrevazenyNaZnameSpolecne') }
] as const;
export type Method = typeof METHODS[number]['id'];
export interface Person { id: number; age: number; sex: number; education: number; phone: number; minutes: number; cell: number }
export interface PopulationSpec { size: number; seed: string; shares: number[] }
export interface Population { spec: PopulationSpec; people: Person[]; cells: number[][]; apple: number; minutes: number }
export interface SamplingConfig { population: PopulationSpec; n: number; repeats: number; confidence: number; seed: string; demographicBias: number; outcomeBias: number; method: Method }
export interface EstimatePair { apple: Interval; minutes: Interval }
export interface MethodResult { estimates: EstimatePair | null; effectiveN: number | null; counts: number[]; weights: (number | null)[]; insufficient: number[] }
export interface MomentSummary { count: number; sum: number; squaredError: number; widthSum: number; covered: number }
export interface MethodSummary { apple: MomentSummary; minutes: MomentSummary; skipped: number; effectiveSum: number; last: MethodResult | null; recent: EstimatePair[] }
export type Summary = Record<Method, MethodSummary>;
export interface SamplingIteration { iteration: number; estimates: EstimatePair | null; insufficient: number[]; sample?: { counts: number[]; weights: (number | null)[]; effectiveN: number | null } }
export type SamplingCommand = { type: 'generate'; spec: PopulationSpec } | { type: 'simulate'; config: SamplingConfig; speed: number } | { type: 'pause' | 'resume' } | { type: 'speed'; speed: number };
export type SamplingMessage = { type: 'population-progress'; completed: number; total: number } | { type: 'population-ready'; population: Population } | { type: 'progress' | 'completed' | 'paused'; completed: number; summary: MethodSummary; history: SamplingIteration[] } | { type: 'error'; message: string };

export function validatePopulation(spec: PopulationSpec): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(spec.size) || spec.size < 10000 || spec.size > MAX_POPULATION) errors.push(t('sampling.velikostPopulaceMusiBytCeleCisloOd10'));
  if (spec.shares.length !== 8 || spec.shares.some(v => !Number.isFinite(v) || v < 2 || v > 60)) errors.push(t('sampling.kazdaZOsmiDemografickychSkupinMusiMitPodil'));
  if (Math.abs(spec.shares.reduce((sum, x) => sum + x, 0) - 100) > 1e-7) errors.push(t('sampling.podilyVekuPohlaviMusiMitSoucet100'));
  return errors;
}
export function validateSampling(config: SamplingConfig): string[] {
  const errors = validatePopulation(config.population);
  if (!METHODS.some(method => method.id === config.method)) errors.push(t('sampling.vybertePlatnouMetoduVyberu'));
  if (!Number.isInteger(config.n) || config.n < 80 || config.n > 2000 || config.n > config.population.size / 5) errors.push(t('sampling.velikostVzorkuMusiBytCeleCisloOd80'));
  if (!Number.isInteger(config.repeats) || config.repeats < 1 || config.repeats > MAX_REPEATS) errors.push(t('sampling.pocetOpakovaniMusiBytCeleCisloOd1'));
  if (!Number.isFinite(config.confidence) || config.confidence < .8 || config.confidence > .99) errors.push(t('sampling.spolehlivostMusiBytOd80Do99'));
  if (![config.demographicBias, config.outcomeBias].every(v => Number.isFinite(v) && v >= 0 && v <= 2)) errors.push(t('sampling.silaZkresleniMusiBytOd0Do2'));
  return errors;
}
export function createPopulation(spec: PopulationSpec, onProgress?: (completed: number, total: number) => void): Population {
  const errors = validatePopulation(spec);
  if (errors.length) throw new Error(errors[0]);
  const random = seededRandom(`population:${spec.seed}`);
  const counts = realizePopulation(spec.size, spec.shares.map((weight, id) => ({ id, weight, name: String(id), color: '' }))).map(c => c.count);
  const people: Person[] = [], cells: number[][] = counts.map(() => []);
  let appleCount = 0, minutesSum = 0;
  onProgress?.(0, spec.size);
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
  counts.forEach((count, cell) => {
    const group = Math.floor(cell / 2), sex = cell % 2;
    for (let i = 0; i < count; i++) {
      const age = [18, 30, 45, 60][group] + Math.floor(random() * [12, 15, 15, 20][group]);
      const u = random(), universityShare = [.32, .40, .28, .18][group];
      const education = u < universityShare ? 2 : u < .90 ? 1 : 0;
      const activity = normal();
      const appleProbability = 1 / (1 + Math.exp(-(.2 - group * .48 + (education - 1) * .55 + .12 * (1 - sex) + .45 * activity)));
      const phone = random() < appleProbability ? 0 : random() < .55 ? 1 : random() < .65 ? 2 : 3;
      // Shared activity relates the two outcomes within each demographic cell.
      const minutes = Math.round(Math.min(10080, Math.max(20, (1600 - group * 280 + education * 130 + sex * 90) * Math.exp(.38 * activity - .38 ** 2 / 2))));
      const id = people.length;
      people.push({ id: id + 1, age, sex, education, phone, minutes, cell }); cells[cell].push(id);
      appleCount += Number(phone === 0); minutesSum += minutes;
      if (people.length % 1000 === 0) onProgress?.(people.length, spec.size);
    }
  });
  if (people.length % 1000 !== 0) onProgress?.(people.length, spec.size);
  return { spec: { ...spec, shares: [...spec.shares] }, people, cells, apple: appleCount / people.length, minutes: minutesSum / people.length };
}

// Floyd's algorithm gives a uniform subset without copying the population.
export function randomIndices(size: number, n: number, random: () => number): number[] {
  if (!Number.isInteger(n) || n < 0 || n > size) throw new Error(t('sampling.neplatnaVelikostVzorku'));
  const selected = new Set<number>();
  for (let j = size - n; j < size; j++) { const k = Math.floor(random() * (j + 1)); selected.add(selected.has(k) ? j : k); }
  return [...selected];
}
export function stratifiedAllocation(sizes: number[], n: number): number[] {
  const total = sizes.reduce((sum, x) => sum + x, 0);
  if (n < sizes.length * 2 || n > total || sizes.some(x => x < 2)) throw new Error(t('sampling.proStratifikaciPotrebujemeAlesponDvaLidiVKazde'));
  const raw = sizes.map(size => n * size / total), allocation = raw.map(Math.floor);
  const order = raw.map((x, i) => ({ i, remainder: x - allocation[i] })).sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let k = 0, remaining = n - allocation.reduce((sum, x) => sum + x, 0); k < remaining; k++) allocation[order[k].i]++;
  for (let h = 0; h < sizes.length; h++) while (allocation[h] < 2) {
    const donor = allocation.reduce((best, value, i) => value > allocation[best] ? i : best, 0);
    allocation[donor]--; allocation[h]++;
  }
  return allocation;
}
export function convenienceCDF(population: Population, demographicBias: number, outcomeBias: number): number[] {
  let sum = 0;
  return population.people.map(person => {
    const ageGroup = Math.floor(person.cell / 2);
    const logWeight = demographicBias * (-.55 * ageGroup - .22 * person.sex) + outcomeBias * (.8 * Number(person.phone === 0) + .65 * Math.log(person.minutes / 1500));
    sum += Math.exp(logWeight); return sum;
  });
}
export function convenienceIndices(cdf: ArrayLike<number>, n: number, random: () => number): number[] {
  if (n > cdf.length) throw new Error(t('sampling.vzorekJeVetsiNezPopulace'));
  const selected = new Set<number>(), total = cdf[cdf.length - 1];
  while (selected.size < n) {
    const value = random() * total; let low = 0, high = cdf.length - 1;
    while (low < high) { const mid = (low + high) >>> 1; if (cdf[mid] > value) high = mid; else low = mid + 1; }
    selected.add(low);
  }
  return [...selected];
}
function moments(people: Person[], variable: 'apple' | 'minutes') {
  const values = people.map(p => variable === 'apple' ? Number(p.phone === 0) : p.minutes);
  const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
  const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (values.length - 1);
  return { mean, variance };
}
export function estimateSample(population: Population, ids: number[], method: Method, confidence: number): MethodResult {
  if (ids.length < 2 || new Set(ids).size !== ids.length || ids.some(id => !population.people[id])) throw new Error(t('sampling.vzorekMusiObsahovatAlesponDveRuzneOsobyZ'));
  const sample = ids.map(id => population.people[id]);
  const groups = population.cells.map((_, h) => sample.filter(person => person.cell === h));
  const counts = groups.map(group => group.length);
  const grouped = method === 'stratified' || method === 'weighted';
  const insufficient = grouped ? counts.flatMap((count, h) => count < 2 ? [h] : []) : [];
  const weights = counts.map((count, h) => count ? population.cells[h].length / population.people.length / (count / sample.length) : null);
  if (insufficient.length) return { estimates: null, effectiveN: null, counts, weights, insufficient };
  const z = normalQuantile((1 + confidence) / 2);
  const interval = (variable: 'apple' | 'minutes'): Interval => {
    let estimate: number, variance: number;
    if (grouped) {
      estimate = 0; variance = 0;
      groups.forEach((group, h) => {
        const weight = population.cells[h].length / population.people.length;
        const stats = moments(group, variable);
        const fpc = method === 'stratified' ? 1 - group.length / population.cells[h].length : 1;
        estimate += weight * stats.mean; variance += weight ** 2 * fpc * stats.variance / group.length;
      });
    } else {
      const stats = moments(sample, variable); estimate = stats.mean;
      variance = stats.variance / sample.length * (method === 'random' ? 1 - sample.length / population.people.length : 1);
    }
    const half = z * Math.sqrt(Math.max(0, variance));
    const low = Math.max(0, estimate - half), high = variable === 'apple' ? Math.min(1, estimate + half) : estimate + half;
    return { estimate, low, high, outside: isOutside(population[variable], low, high) };
  };
  const squaredWeights = grouped ? counts.reduce((sum, count, h) => sum + count * weights[h]! ** 2, 0) : sample.length;
  return { estimates: { apple: interval('apple'), minutes: interval('minutes') }, effectiveN: sample.length ** 2 / squaredWeights, counts, weights, insufficient };
}
export function createSummary(): Summary {
  const metric = (): MomentSummary => ({ count: 0, sum: 0, squaredError: 0, widthSum: 0, covered: 0 });
  const method = (): MethodSummary => ({ apple: metric(), minutes: metric(), skipped: 0, effectiveSum: 0, last: null, recent: [] });
  return { random: method(), stratified: method(), convenience: method(), weighted: method() };
}
export function addResult(summary: MethodSummary, result: MethodResult, population: Population) {
  summary.last = result;
  if (!result.estimates) { summary.skipped++; return; }
  for (const variable of ['apple', 'minutes'] as const) {
    const interval = result.estimates[variable], metric = summary[variable];
    metric.count++; metric.sum += interval.estimate; metric.squaredError += (interval.estimate - population[variable]) ** 2;
    metric.widthSum += interval.high - interval.low; metric.covered += Number(!interval.outside);
  }
  summary.effectiveSum += result.effectiveN!; summary.recent.push(result.estimates);
  if (summary.recent.length > 20) summary.recent.shift();
}
export function compareOnce(population: Population, config: SamplingConfig, iteration: number, cdf: number[], allocation: number[]): Record<Method, MethodResult> {
  // Separate streams keep each method reproducible when another method changes.
  const random = randomIndices(population.people.length, config.n, seededRandom(`${config.seed}:random:${iteration}`));
  const stratifiedRandom = seededRandom(`${config.seed}:stratified:${iteration}`);
  const stratified = population.cells.flatMap((cell, h) => randomIndices(cell.length, allocation[h], stratifiedRandom).map(i => cell[i]));
  const convenience = convenienceIndices(cdf, config.n, seededRandom(`${config.seed}:convenience:${iteration}`));
  return { random: estimateSample(population, random, 'random', config.confidence), stratified: estimateSample(population, stratified, 'stratified', config.confidence), convenience: estimateSample(population, convenience, 'convenience', config.confidence), weighted: estimateSample(population, convenience, 'weighted', config.confidence) };
}

export function simulateOnce(population: Population, config: SamplingConfig, iteration: number, cdf: number[], allocation: number[]): MethodResult {
  if (config.method === 'random') return estimateSample(population, randomIndices(population.people.length, config.n, seededRandom(`${config.seed}:random:${iteration}`)), 'random', config.confidence);
  if (config.method === 'stratified') {
    const random = seededRandom(`${config.seed}:stratified:${iteration}`);
    const ids = population.cells.flatMap((cell, h) => randomIndices(cell.length, allocation[h], random).map(i => cell[i]));
    return estimateSample(population, ids, 'stratified', config.confidence);
  }
  const ids = convenienceIndices(cdf, config.n, seededRandom(`${config.seed}:convenience:${iteration}`));
  return estimateSample(population, ids, config.method, config.confidence);
}

export function samplingConvergence(history: SamplingIteration[], variable: 'apple' | 'minutes'): { x: number; y: number }[] {
  let valid = 0, outside = 0;
  return history.flatMap(entry => {
    const interval = entry.estimates?.[variable];
    if (interval) { valid++; outside += Number(interval.outside); }
    return valid ? [{ x: entry.iteration, y: outside / valid * 100 }] : [];
  });
}
