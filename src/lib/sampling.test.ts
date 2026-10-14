import { describe, expect, it } from 'vitest';
import { normalQuantile, seededRandom } from './statistics';
import { addResult, compareOnce, convenienceCDF, convenienceIndices, createPopulation, createSummary, DEFAULT_SHARES, estimateSample, METHODS, randomIndices, stratifiedAllocation, validatePopulation, validateSampling, simulateOnce, samplingConvergence, type Population, type SamplingConfig } from './sampling';

const spec = { size: 10000, seed: 'test-population', shares: DEFAULT_SHARES };
const population = createPopulation(spec);
const config: SamplingConfig = { population: spec, n: 400, repeats: 200, confidence: .95, seed: 'test-sampling', demographicBias: 1.5, outcomeBias: 0, method: 'random' };

describe('Společný syntetický dataset', () => {
  it('hlásí skutečný postup od nuly do všech osob a zachovává reprodukovatelnost', () => {
    const progress: number[] = [];
    const generated = createPopulation({ ...spec, size: 10501 }, (completed, total) => {
      expect(total).toBe(10501); progress.push(completed);
    });
    expect(progress[0]).toBe(0); expect(progress.at(-1)).toBe(10501);
    expect(progress).toContain(1000); expect(progress).toContain(10000);
    expect(progress.every((value, i) => i === 0 || value > progress[i - 1])).toBe(true);
    expect(generated).toEqual(createPopulation({ ...spec, size: 10501 }));
  });
  it('je reprodukovatelný, má přesné demografické cíle a oba ukazatele na každé osobě', () => {
    expect(createPopulation(spec)).toEqual(population);
    expect(population.people).toHaveLength(10000);
    expect(population.cells.map(cell => cell.length)).toEqual(DEFAULT_SHARES.map(share => share * 100));
    expect(new Set(population.people.map(p => p.id)).size).toBe(10000);
    expect(new Set(population.people.map(p => p.phone)).size).toBe(4);
    for (const person of population.people) {
      expect(person.minutes).toBeGreaterThanOrEqual(0); expect(person.minutes).toBeLessThanOrEqual(10080);
      expect(person.age).toBeGreaterThanOrEqual(18); expect(person.age).toBeLessThanOrEqual(79);
      expect(population.cells[person.cell]).toContain(person.id - 1);
    }
    expect(population.apple).toBe(population.people.filter(p => p.phone === 0).length / 10000);
    expect(population.minutes).toBe(population.people.reduce((sum, p) => sum + p.minutes, 0) / 10000);
  });
  it('odmítá neplatné rozpočty, podíly a chybějící číselné vstupy', () => {
    expect(validateSampling(config)).toEqual([]);
    expect(validateSampling({ ...config, n: 2000, repeats: 10000 })).toEqual([]);
    for (const patch of [{ n: 1 }, { n: NaN }, { repeats: 0 }, { repeats: 10001 }, { repeats: 1.5 }, { repeats: NaN }, { confidence: 1 }, { demographicBias: -1 }, { outcomeBias: NaN }]) expect(validateSampling({ ...config, ...patch }).length).toBeGreaterThan(0);
    expect(validatePopulation({ ...spec, shares: [100] }).length).toBeGreaterThan(0);
    expect(validatePopulation({ ...spec, shares: DEFAULT_SHARES.map(x => x / 2) }).length).toBeGreaterThan(0);
  });
});

describe('Výběry bez vracení a váhy', () => {
  it('vybírá unikátní osoby a drží přesné n i malé straty', () => {
    const ids = randomIndices(10000, 400, seededRandom('unique'));
    expect(new Set(ids).size).toBe(400); expect(Math.max(...ids)).toBeLessThan(10000);
    const allocation = stratifiedAllocation([200, 200, 1600, 1600, 1600, 1600, 1600, 1600], 80);
    expect(allocation.reduce((sum, x) => sum + x, 0)).toBe(80); expect(Math.min(...allocation)).toBeGreaterThanOrEqual(2);
    const cdf = convenienceCDF(population, 1.5, 1);
    expect(new Set(convenienceIndices(cdf, 400, seededRandom('convenience'))).size).toBe(400);
  });
  it('u příležitostného výběru převažuje přesně stejné osoby a reprodukuje výpočet', () => {
    const cdf = convenienceCDF(population, 1, 0), allocation = stratifiedAllocation(population.cells.map(c => c.length), 400);
    const results = compareOnce(population, config, 0, cdf, allocation);
    expect(compareOnce(population, config, 0, cdf, allocation)).toEqual(results);
    METHODS.forEach(({ id }) => expect(simulateOnce(population, { ...config, method: id }, 0, cdf, allocation)).toEqual(results[id]));
    expect(results.weighted.counts).toEqual(results.convenience.counts);
    expect(results.weighted.estimates).not.toBeNull();
    const counts = results.weighted.counts, weights = results.weighted.weights;
    expect(counts.reduce((sum, count, h) => sum + count * weights[h]!, 0)).toBeCloseTo(config.n);
    counts.forEach((count, h) => expect(count * weights[h]! / config.n).toBeCloseTo(population.cells[h].length / population.people.length));
    expect(results.weighted.effectiveN).toBeLessThanOrEqual(config.n + 1e-8);
  });
  it('nevynechává prázdné skupiny a nevydává rozptyl z jediné osoby', () => {
    const onlyOneCell = population.cells[0].slice(0, 100);
    expect(estimateSample(population, onlyOneCell, 'weighted', .95).estimates).toBeNull();
    const singleton = population.cells.flatMap((cell, h) => cell.slice(0, h === 0 ? 1 : 3));
    expect(estimateSample(population, singleton, 'weighted', .95).insufficient).toEqual([0]);
  });
  it('používá analytický rozptyl stratifikace a korekci na konečnou populaci', () => {
    const people = Array.from({ length: 24 }, (_, id) => ({ id: id + 1, age: 30, sex: id % 2, education: 1, phone: id % 3 === 0 ? 0 : 1, minutes: 100 * (id % 3 + 1) + 10 * Math.floor(id / 3), cell: Math.floor(id / 3) }));
    const tiny: Population = { spec, people, cells: Array.from({ length: 8 }, (_, h) => [3 * h, 3 * h + 1, 3 * h + 2]), apple: 1 / 3, minutes: 235 };
    const ids = tiny.cells.flatMap(cell => cell.slice(0, 2)), z = normalQuantile(.975);
    const weighted = estimateSample(tiny, ids, 'weighted', .95).estimates!.minutes;
    const stratified = estimateSample(tiny, ids, 'stratified', .95).estimates!.minutes;
    expect(weighted.estimate).toBe(185); expect(stratified.estimate).toBe(185);
    expect(weighted.high - weighted.estimate).toBeCloseTo(z * Math.sqrt(312.5));
    expect(stratified.high - stratified.estimate).toBeCloseTo(z * Math.sqrt(312.5 / 3));
    const census = estimateSample(tiny, people.map((_, i) => i), 'stratified', .95).estimates!;
    expect(census.minutes.low).toBe(235); expect(census.minutes.high).toBe(235);
    expect(census.apple.estimate).toBeCloseTo(tiny.apple);
  });
});

describe('Výukový efekt opakovaných výběrů', () => {
  it('konvergence počítá chyby jen z platných intervalů a zachovává pořadí všech výběrů', () => {
    const hit = { low: .3, high: .5, estimate: .4, outside: false };
    const miss = { low: .6, high: .8, estimate: .7, outside: true };
    const history = Array.from({ length: 60 }, (_, i) => ({ iteration: i + 1, estimates: i % 3 === 0 ? null : { apple: i % 3 === 1 ? hit : miss, minutes: hit }, insufficient: i % 3 === 0 ? [0] : [] }));
    const apple = samplingConvergence(history, 'apple'), minutes = samplingConvergence(history, 'minutes');
    expect(apple).toHaveLength(59);
    expect(apple[0]).toEqual({ x: 2, y: 0 });
    expect(apple[1]).toEqual({ x: 3, y: 50 });
    expect(apple[2]).toEqual({ x: 4, y: 50 });
    expect(apple.at(-1)).toEqual({ x: 60, y: 50 });
    expect(minutes.at(-1)).toEqual({ x: 60, y: 0 });
    expect(history).toHaveLength(60);
    expect(samplingConvergence([{ iteration: 1, estimates: null, insufficient: [0] }], 'apple')).toEqual([]);
  });
  const simulate = (outcomeBias: number) => {
    const settings = { ...config, outcomeBias }, summary = createSummary();
    const cdf = convenienceCDF(population, settings.demographicBias, outcomeBias), allocation = stratifiedAllocation(population.cells.map(c => c.length), settings.n);
    for (let i = 0; i < settings.repeats; i++) {
      const results = compareOnce(population, settings, i, cdf, allocation);
      METHODS.forEach(({ id }) => addResult(summary[id], results[id], population));
    }
    return summary;
  };
  it('vážení opravuje demografické zkreslení u obou ukazatelů, náhodné intervaly pokrývají skutečnost', () => {
    const results = simulate(0);
    for (const variable of ['apple', 'minutes'] as const) {
      const truth = population[variable], unweighted = results.convenience[variable], weighted = results.weighted[variable];
      const rawBias = Math.abs(unweighted.sum / unweighted.count - truth), weightedBias = Math.abs(weighted.sum / weighted.count - truth);
      expect(weightedBias).toBeLessThan(rawBias / 3);
      for (const method of ['random', 'stratified'] as const) {
        const metric = results[method][variable];
        expect(metric.covered / metric.count).toBeGreaterThan(.85);
        expect(metric.covered / metric.count).toBeLessThanOrEqual(1);
      }
    }
    expect(results.weighted.recent.length).toBe(20);
    expect(results.weighted.apple.count + results.weighted.skipped).toBe(config.repeats);
  });
  it('vážení podle demografie neodstraní výběr závislý na sledovaných ukazatelích', () => {
    const results = simulate(1.5);
    expect(results.weighted.apple.sum / results.weighted.apple.count - population.apple).toBeGreaterThan(.05);
    expect(results.weighted.minutes.sum / results.weighted.minutes.count - population.minutes).toBeGreaterThan(50);
    expect(results.weighted.apple.covered / results.weighted.apple.count).toBeLessThan(.8);
  });
});
