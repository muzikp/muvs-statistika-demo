import { describe, expect, it } from 'vitest';
import { addSample, confidenceInterval, createBatch, createGlobal, isOutside, mergeBatch, normalQuantile, realizePopulation, sampleWithoutReplacement, seededRandom, validate } from './statistics';
import type { SimulationConfig } from './types';

const config: SimulationConfig = { N: 10000, n: 100, confidence: .95, samplesPerBatch: 20, batches: 1000, method: 'wilson', seed: 'test', categories: [{ id: 1, name: 'Škoda', weight: 50, color: '#397ec1' }, { id: 2, name: 'Toyota', weight: 20, color: '#c34e4e' }, { id: 3, name: 'Hyundai', weight: 30, color: '#6b86b5' }] };
describe('Populace a validace', () => {
  it('přidělí přesně N jednotek a shody rozhodne pořadím', () => {
    const categories = config.categories.map(c => ({ ...c, weight: 100 / 3 }));
    expect(realizePopulation(20, categories).map(c => c.count)).toEqual([7, 7, 6]);
    for (let N = 1; N < 100; N++) expect(realizePopulation(N, config.categories).reduce((s, c) => s+c.count, 0)).toBe(N);
  });
  it('odmítne nesprávný součet, NaN, zlomek, velký výběr a neplatné počty opakování', () => {
    expect(validate(config)).toEqual([]);
    expect(validate({ ...config, categories: config.categories.map(c => ({ ...c, weight: 20 })) }).length).toBeGreaterThan(0);
    for (const patch of [{ N: NaN }, { n: 1.5 }, { n: 501 }, { batches: 0 }, { batches: 1.5 }, { batches: Number.MAX_SAFE_INTEGER + 1 }, { samplesPerBatch: -1 }, { samplesPerBatch: NaN }, { confidence: 1 }]) expect(validate({ ...config, ...patch }).length).toBeGreaterThan(0);
    expect(validate({ ...config, n: 500, batches: 5001, samplesPerBatch: 1001 })).toEqual([]);
  });
});
describe('Výběr bez vracení', () => {
  it('garantuje velikost, celé četnosti a kapacity i pro celou populaci', () => {
    const rng = seededRandom('draws');
    for (let n = 0; n <= 20; n++) for (let i = 0; i < 30; i++) {
      const sample = sampleWithoutReplacement([2, 0, 7, 11], n, rng);
      expect(sample.reduce((s, c) => s+c, 0)).toBe(n);
      sample.forEach((x, k) => { expect(Number.isInteger(x)).toBe(true); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual([2, 0, 7, 11][k]); });
    }
    expect(sampleWithoutReplacement([2, 0, 7, 11], 20, rng)).toEqual([2, 0, 7, 11]);
  });
  it('má hypergeometrickou pravděpodobnost a rozptyl, nikoliv výběr s vracením', () => {
    const rng = seededRandom('hypergeom');
    const frequencies = [0, 0, 0];
    for (let i = 0; i < 30000; i++) frequencies[sampleWithoutReplacement([2, 2], 2, rng)[0]]++;
    expect(frequencies[0] / 30000).toBeCloseTo(1/6, 2);
    expect(frequencies[1] / 30000).toBeCloseTo(4/6, 2);
    expect(frequencies[2] / 30000).toBeCloseTo(1/6, 2);
  });
});
describe('Intervaly a agregace', () => {
  it('počítá kvantil a známý Wilsonův interval', () => {
    const z = normalQuantile(.975);
    expect(z).toBeCloseTo(1.9599639845, 7);
    const [low, high] = confidenceInterval(50, 100, z, 'wilson');
    expect(low).toBeCloseTo(.40383153, 7); expect(high).toBeCloseTo(.59616847, 7);
    expect(normalQuantile(.5)).toBe(0);
    expect(normalQuantile(.025)).toBeCloseTo(-z, 7);
  });
  it('udrží meze v [0,1] a zahrne krajní body', () => {
    for (const method of ['wilson', 'wald'] as const) for (let x = 0; x <= 10; x++) {
      const [l, h] = confidenceInterval(x, 10, normalQuantile(.995), method);
      expect(l).toBeGreaterThanOrEqual(0); expect(h).toBeLessThanOrEqual(1); expect(l).toBeLessThanOrEqual(h);
      expect(isOutside(l, l, h)).toBe(false); expect(isOutside(h, l, h)).toBe(false);
    }
    expect(isOutside(.5, .6, .8)).toBe(true);
    expect(isOutside(0, ...confidenceInterval(0, 100, normalQuantile(.975), 'wilson'))).toBe(false);
  });
  const simulate = (seed: string, batches = 2, samplesPerBatch = 20) => {
    const cfg = { ...config, seed, batches, samplesPerBatch };
    const pop = realizePopulation(cfg.N, cfg.categories), rng = seededRandom(seed);
    const global = createGlobal(3), output = [];
    for (let i = 0; i < batches; i++) {
      const batch = createBatch(i+1, 3);
      for (let j = 0; j < samplesPerBatch; j++) addSample(batch, sampleWithoutReplacement(pop.map(c => c.count), cfg.n, rng), pop, cfg, normalQuantile(.975));
      mergeBatch(global, batch); output.push(batch);
    }
    return { global, output };
  };
  it('reprodukuje výsledky a agreguje dávky správně', () => {
    expect(simulate('same')).toEqual(simulate('same'));
    expect(simulate('different')).not.toEqual(simulate('same'));
    const { global, output } = simulate('aggregation', 4, 30);
    expect(global.samples).toBe(120); expect(global.batches).toBe(4);
    global.categories.forEach((c, k) => {
      expect(c.outside).toBe(output.reduce((s,b) => s+b.categories[k].outside, 0));
      expect(c.sum).toBeCloseTo(output.reduce((s,b) => s+b.categories[k].sum, 0), 10);
    });
    for (const b of output) for (const c of b.categories) { expect(c.histogram.reduce((s,x) => s+x, 0)).toBe(30); expect(c.intervals).toHaveLength(20); }
  });
  it('má empirické marginální pokrytí blízko nominálnímu v režimu aproximace', () => {
    const { global } = simulate('coverage-integration', 1000, 20);
    for (const c of global.categories) expect(Math.abs((1 - c.outside / global.samples) - .95)).toBeLessThan(.015);
  });
});
