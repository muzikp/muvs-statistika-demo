import { describe, expect, it } from 'vitest';
import { calculateProbability as calc, operations } from './probability';

describe('Pravděpodobnosti dvou jevů', () => {
  it('počítá všechny operace ze čtyř částí prostoru', () => {
    const expected = [.2, .7, .3, .2, .3, .5, .6, .5, .4, .5];
    operations.forEach((op, index) => {
      const result = calc(.5, .4, .2, 'known', op.id);
      expect(result.errors).toEqual([]);
      expect(result.range?.low).toBeCloseTo(expected[index]);
      expect(result.range?.high).toBeCloseTo(expected[index]);
      expect(Object.values(result.regions!).reduce((sum, x) => sum + x, 0)).toBeCloseTo(1);
    });
  });
  it('odlišuje nezávislost a neslučitelnost', () => {
    expect(calc(.5, .4, 0, 'independent', 'intersection').intersection).toBe(.2);
    expect(calc(.5, .4, .2, 'disjoint', 'intersection').range?.low).toBe(0);
    expect(calc(.8, .4, 0, 'disjoint', 'union').errors.length).toBeGreaterThan(0);
  });
  it('odmítá nemožné hodnoty včetně průniku mimo obě meze', () => {
    for (const [a, b, i] of [[NaN, .5, 0], [-.1, .5, 0], [1.1, .5, 0], [.8, .7, .4], [.3, .4, .31], [.3, .4, NaN]]) {
      expect(calc(a, b, i, 'known', 'union').range).toBeNull();
    }
  });
  it('bez průniku uvádí meze a nevnucuje nezávislost', () => {
    expect(calc(.6, .7, 0, 'unknown', 'intersection').range?.low).toBeCloseTo(.3);
    expect(calc(.6, .7, 0, 'unknown', 'union').range?.low).toBeCloseTo(.7);
    expect(calc(.6, .7, 0, 'unknown', 'union').range?.high).toBeCloseTo(1);
    expect(calc(.6, .7, 0, 'unknown', 'notA').range).toEqual({ low: .4, high: .4 });
    expect(calc(.6, .7, 0, 'unknown', 'givenA').range?.high).toBe(1);
  });
  it('ošetřuje nulovou podmínku i degenerované jevy', () => {
    expect(calc(.5, 0, 0, 'known', 'givenB').undefinedConditional).toBe(true);
    expect(calc(0, .5, 0, 'known', 'givenA').range).toBeNull();
    expect(calc(1, 1, 1, 'known', 'union').range?.low).toBe(1);
    expect(calc(0, 0, 0, 'unknown', 'intersection').range?.high).toBe(0);
    expect(calc(.1, .2, .1, 'known', 'onlyA').range?.low).toBe(0);
  });
});
