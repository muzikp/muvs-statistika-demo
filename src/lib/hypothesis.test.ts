import { describe, expect, it } from 'vitest';
import { studentCdf, studentDensity, studentQuantile, studentSurvival } from './student';
import { cohensD, groupEstimate, createHypothesisPopulation, DEFAULT_HYPOTHESIS_SPEC, density, hypothesisConvergence, hypothesisNullTrue, hypothesisSampler, validateHypothesis, welchResult, type GroupEstimate, type HypothesisConfig } from './hypothesis';

const spec = { ...DEFAULT_HYPOTHESIS_SPEC, size: 10000 };
const population = createHypothesisPopulation(spec);
const config: HypothesisConfig = { population: spec, nA: 100, nB: 150, repeats: 10000, seed: 'hypothesis-check', alpha: .05, nullDifference: 0, alternative: 'two-sided' };

describe('Student distribution and Welch test', () => {
  it('standardizes B minus A consistently, preserving sign and units and rejecting undefined effects', () => {
    expect(cohensD(60, 65, 10, 10)).toBe(.5);
    expect(cohensD(65, 60, 10, 10)).toBe(-.5);
    expect(cohensD(60, 65, 12, 16)).toBeCloseTo(5 / Math.sqrt(200), 12);
    expect(cohensD(600, 650, 120, 160)).toBe(cohensD(60, 65, 12, 16));
    expect(cohensD(60, 60, 10, 10)).toBe(0);
    expect(cohensD(60, 65, 0, 0)).toBeNull();
    expect(cohensD(60, 65, -1, 10)).toBeNull();
    expect(cohensD(60, 65, NaN, 10)).toBeNull();
  });
  it('matches analytic Cauchy and df=2 distributions and reference t quantiles', () => {
    for (const x of [-20, -3, -.2, 0, .2, 3, 20]) {
      expect(studentCdf(x, 1)).toBeCloseTo(.5 + Math.atan(x) / Math.PI, 11);
      expect(studentCdf(x, 2)).toBeCloseTo(.5 + x / (2 * Math.sqrt(x * x + 2)), 11);
      expect(studentSurvival(x, 1) + studentCdf(x, 1)).toBeCloseTo(1, 12);
    }
    expect(studentDensity(0, 1)).toBeCloseTo(1 / Math.PI, 12);
    expect(studentQuantile(.975, 1)).toBeCloseTo(12.706204736, 8);
    expect(studentQuantile(.975, 10)).toBeCloseTo(2.228138852, 8);
    expect(studentQuantile(.975, 100)).toBeCloseTo(1.983971518, 8);
    expect(studentSurvival(100, 100)).toBeGreaterThan(0);
  });
  it('computes unequal-variance df and coherent intervals for all alternatives', () => {
    const group = (mean: number, variance: number, n: number): GroupEstimate => ({ mean, variance, dfDenominator: variance ** 2 / (n - 1), sd: Math.sqrt(variance * n), effectSd: Math.sqrt(variance * n) });
    const a = group(10, .4, 10), b = group(12, .45, 20);
    for (const alternative of ['two-sided', 'greater', 'less'] as const) {
      const result = welchResult(a, b, { ...config, alternative }, 2)!;
      expect(result.statistic).toBeCloseTo(2 / Math.sqrt(.85), 12);
      expect(result.seA).toBeCloseTo(Math.sqrt(.4), 12);
      expect(result.seB).toBeCloseTo(Math.sqrt(.45), 12);
      expect(result.se ** 2).toBeCloseTo(result.seA ** 2 + result.seB ** 2, 12);
      expect(result.df).toBeCloseTo(.85 ** 2 / (.4 ** 2 / 9 + .45 ** 2 / 19), 12);
      const excludesNull = alternative === 'less' ? result.high < 0 : alternative === 'greater' ? result.low > 0 : result.low > 0 || result.high < 0;
      expect(result.reject).toBe(excludesNull);
      expect(result.outside).toBe(false);
      if (alternative === 'greater') expect(result.high).toBe(Infinity);
      if (alternative === 'less') expect(result.low).toBe(-Infinity);
    }
    expect(welchResult(group(10, 0, 10), group(12, 0, 20), config, 2)).toBeNull();
  });
});

describe('Two finite populations and repeated hypothesis tests', () => {
  it('uses reproducible positive times, exact chosen means and real progress', () => {
    const progress: number[] = [];
    const repeated = createHypothesisPopulation({ ...spec, meanB: spec.meanA + 3.5 }, (completed, total) => { expect(total).toBe(20000); progress.push(completed); });
    expect(repeated.groups[0]).toEqual(population.groups[0]);
    expect(repeated.summary.truth).toBe(3.5);
    const populationVariances = repeated.groups.map((values, g) => values.reduce((sum, value) => sum + (value - repeated.summary.groups[g].mean) ** 2, 0) / values.length);
    expect(repeated.summary.cohensD).toBeCloseTo(3.5 / Math.sqrt((populationVariances[0] + populationVariances[1]) / 2), 12);
    repeated.groups.forEach((values, g) => {
      expect(values.reduce((sum, value) => sum + value, 0) / values.length).toBeCloseTo(spec.meanA + (g ? 3.5 : 0), 9);
      expect(values.every(value => value > 0)).toBe(true);
    });
    expect(progress[0]).toBe(0); expect(progress.at(-1)).toBe(20000); expect(progress).toContain(1000);
    expect(repeated.groups.map(group => group.length)).toEqual([spec.size, spec.size]);
  });
  it('draws independent samples without replacement and reproduces the selected people', () => {
    const draw = hypothesisSampler(population, config)(0);
    expect(draw.ids.map(ids => new Set(ids).size)).toEqual([config.nA, config.nB]);
    expect(draw.ids[0]).not.toEqual(draw.ids[1].slice(0, config.nA));
    expect(hypothesisSampler(population, config)(0)).toEqual(draw);
    expect(draw.entry.result!.p).toBeGreaterThanOrEqual(0);
    expect(draw.entry.result!.p).toBeLessThanOrEqual(1);
  });
  it('keeps preview draws nested as sample size grows and holds people fixed when only the test changes', () => {
    {
      const initial = hypothesisSampler(population, config, true)(3);
      const enlarged = hypothesisSampler(population, { ...config, nA: 200, nB: 250 }, true)(3);
      expect(enlarged.ids[0].slice(0, config.nA)).toEqual(initial.ids[0]);
      expect(enlarged.ids[1].slice(0, config.nB)).toEqual(initial.ids[1]);
      const differentTest = hypothesisSampler(population, { ...config, alpha: .01, alternative: 'greater', nullDifference: 3 }, true)(3);
      expect(differentTest.ids).toEqual(initial.ids);
      expect(differentTest.entry.result!.cohensD).toBe(initial.entry.result!.cohensD);
      expect(differentTest.entry.result!.p).not.toBe(initial.entry.result!.p);
      expect(hypothesisSampler(population, config, true)(4).ids).not.toEqual(initial.ids);
    }
    const changed = createHypothesisPopulation({ ...spec, meanA: 70, meanB: 65 });
    expect(changed.summary.groups.map(group => group.mean)).toEqual([70, 65]);
    expect(changed.summary.truth).toBe(-5);
  });
  it('estimates ordinary sample variance and applies the finite-population correction to SE', () => {
    const ids = Array.from({ length: 80 }, (_, i) => i * 7);
    const estimate = groupEstimate(population, 0, ids)!;
    const values = ids.map(id => population.groups[0][id]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    expect(estimate.mean).toBeCloseTo(mean, 12);
    expect(estimate.effectSd).toBeCloseTo(Math.sqrt(variance), 12);
    expect(estimate.variance).toBeCloseTo(variance / values.length * (1 - values.length / spec.size), 12);
    expect(groupEstimate(population, 0, [0])).toBeNull();
    const result = hypothesisSampler(population, config)(0).entry.result!;
    expect(result.cohensD).toBe(cohensD(result.meanA, result.meanB, result.sdA, result.sdB));
  });
  it('classifies composite one-sided nulls and excludes invalid tests from convergence', () => {
    expect(hypothesisNullTrue(-3, { alternative: 'greater', nullDifference: 0 })).toBe(true);
    expect(hypothesisNullTrue(3, { alternative: 'greater', nullDifference: 0 })).toBe(false);
    expect(hypothesisNullTrue(3, { alternative: 'less', nullDifference: 0 })).toBe(true);
    const entry = hypothesisSampler(population, config)(0).entry;
    const invalid = { iteration: 2, result: null };
    const summary = hypothesisConvergence([entry, invalid], config);
    expect(summary.valid).toBe(1); expect(summary.skipped).toBe(1);
    expect(summary.averageA).toBe(entry.result!.meanA); expect(summary.averageB).toBe(entry.result!.meanB);
    expect(summary.averageD).toBe(entry.result!.cohensD); expect(summary.countD).toBe(1);
    expect(summary.wrong).toBe(Number(entry.result!.reject));
    const alternative = hypothesisConvergence([entry, invalid], { ...config, population: { ...spec, meanB: spec.meanA + 3 } });
    expect(alternative.wrong).toBe(Number(!entry.result!.reject));
    expect(alternative.decision.at(-1)?.y).toBe(alternative.wrong * 100);
  });
  it('keeps type-I error close to alpha under H0 and gains power for a genuine difference', () => {
    const sampler = hypothesisSampler(population, config);
    const entries = Array.from({ length: 2000 }, (_, i) => sampler(i).entry);
    const summary = hypothesisConvergence(entries, config);
    expect(summary.valid).toBe(2000);
    expect(summary.rejected / 2000).toBeGreaterThan(.03);
    expect(summary.rejected / 2000).toBeLessThan(.075);
    expect(summary.missed).toBe(summary.rejected);
    const changed = createHypothesisPopulation({ ...spec, meanB: spec.meanA + 8 });
    const alternativeConfig = { ...config, population: changed.summary.spec };
    const alternativeSampler = hypothesisSampler(changed, alternativeConfig);
    const power = hypothesisConvergence(Array.from({ length: 300 }, (_, i) => alternativeSampler(i).entry), alternativeConfig);
    expect(power.rejected / power.valid).toBeGreaterThan(.9);
  });
  it('validates limits and supports the smallest independent samples', () => {
    expect(validateHypothesis(config)).toEqual([]);
    expect(validateHypothesis({ ...config, nA: 2000, nB: 2000 })).toEqual([]);
    for (const patch of [{ nA: 19 }, { nB: NaN }, { repeats: 10001 }, { alpha: 0 }, { nullDifference: Infinity }]) expect(validateHypothesis({ ...config, ...patch }).length).toBeGreaterThan(0);
    const small = hypothesisSampler(population, { ...config, nA: 20, nB: 20 })(0).entry;
    expect(small.result).not.toBeNull();
    expect(validateHypothesis({ ...config, population: { ...spec, size: NaN } })).not.toEqual([]);
    expect(density([1, 1, 1], [0, 2], 0).every(point => Number.isFinite(point.y))).toBe(true);
  });
});
