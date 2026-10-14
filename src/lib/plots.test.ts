import { describe, expect, it } from 'vitest';
import { samplingHistogram } from './plots';
import type { SamplingIteration } from './sampling';

const entry = (iteration: number, apple: number, minutes: number): SamplingIteration => ({ iteration, insufficient: [], estimates: { apple: { estimate: apple, low: apple, high: apple, outside: false }, minutes: { estimate: minutes, low: minutes, high: minutes, outside: false } } });

describe('Histogramy odhadů obou veličin', () => {
  it('s více platnými výběry zjemňuje histogram minut a zachovává všechny četnosti', () => {
    const initial = Array.from({ length: 32 }, (_, i) => entry(i + 1, .4, 1000 + i * 10));
    const history = Array.from({ length: 2000 }, (_, i) => ({ ...initial[i % initial.length], iteration: i + 1 }));
    const early = samplingHistogram(initial, 'minutes', 1155);
    const later = samplingHistogram(history, 'minutes', 1155);
    expect(later.width).toBeLessThan(early.width);
    expect(later.points.length).toBeGreaterThan(early.points.length);
    expect(later.points.length).toBeLessThanOrEqual(102);
    expect(later.points.reduce((sum, point) => sum + point.y, 0)).toBe(2000);
    const invalid: SamplingIteration[] = Array.from({ length: 1000 }, (_, i) => ({ iteration: i + 33, estimates: null, insufficient: [0] }));
    expect(samplingHistogram([...initial, ...invalid], 'minutes', 1155).width).toBe(early.width);
  });
  it('zachovává všechny platné odhady a minuty nad 100 mají vlastní měřítko', () => {
    const history = Array.from({ length: 80 }, (_, i) => entry(i + 1, .3 + i / 1000, 1000 + i * 10));
    history.push({ iteration: 81, estimates: null, insufficient: [0] });
    for (const variable of ['apple', 'minutes'] as const) {
      const plot = samplingHistogram(history, variable, variable === 'apple' ? .35 : 1350);
      expect(plot.count).toBe(80);
      expect(plot.points.reduce((sum, point) => sum + point.y, 0)).toBe(80);
      expect(plot.domain[0]).toBeLessThan(plot.domain[1]);
      expect(plot.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    }
    const minutes = samplingHistogram(history, 'minutes', 1350);
    expect(minutes.domain[0]).toBeLessThanOrEqual(1000);
    expect(minutes.domain[1]).toBeGreaterThanOrEqual(1790);
    expect(minutes.points.filter(p => p.y > 0).length).toBeGreaterThan(1);
    expect(samplingHistogram(history, 'apple', .35).reference).toBe(35);
  });
  it('křivku centruje na skutečnost a škáluje na počty v intervalech histogramu', () => {
    const history = Array.from({ length: 101 }, (_, i) => entry(i + 1, .55 + i / 1000, 1500 + i * 3));
    const plot = samplingHistogram(history, 'minutes', 1350);
    const peak = plot.normal.reduce((best, point) => point.y > best.y ? point : best);
    const step = (plot.domain[1] - plot.domain[0]) / 120;
    expect(Math.abs(peak.x - 1350)).toBeLessThanOrEqual(step);
    expect(plot.normal.reduce((sum, point) => sum + point.y * step / plot.width, 0)).toBeCloseTo(101, 0);
  });
  it('ošetřuje prázdný histogram, nulový rozptyl a krajní podíly', () => {
    for (const truth of [0, 1]) {
      const empty = samplingHistogram([], 'apple', truth);
      expect(empty.normal).toEqual([]);
      expect(empty.domain[1]).toBeGreaterThan(empty.domain[0]);
      const repeated = samplingHistogram([entry(1, truth, 1500), entry(2, truth, 1500)], 'apple', truth);
      expect(repeated.normal).toEqual([]);
      expect(repeated.points.reduce((sum, p) => sum + p.y, 0)).toBe(2);
      expect(repeated.domain[0]).toBeGreaterThanOrEqual(0);
      expect(repeated.domain[1]).toBeLessThanOrEqual(100);
    }
  });
});
