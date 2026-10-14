import type { HypothesisPopulationSummary, TestResult } from './hypothesis';

export function hypothesisMeanCurves(result: Pick<TestResult, 'meanA' | 'meanB' | 'seA' | 'seB'>, population: Pick<HypothesisPopulationSummary, 'groups'>) {
  const groups = [result.meanA, result.meanB].map((mean, group) => {
    const se = group ? result.seB : result.seA;
    // Fit to this one draw. This is an uncertainty curve for a mean,
    // not the empirical distribution of individual response times.
    const points = se > 0 ? Array.from({ length: 241 }, (_, i) => {
      const z = -4.5 + 9 * i / 240;
      return { x: mean + z * se, y: Math.exp(-.5 * z * z) / (se * Math.sqrt(2 * Math.PI)) };
    }) : [];
    return { mean, se, points };
  });
  const low = Math.min(...population.groups.map(group => group.mean), ...groups.map(group => group.mean - 4.5 * group.se));
  const high = Math.max(...population.groups.map(group => group.mean), ...groups.map(group => group.mean + 4.5 * group.se));
  const padding = Math.max(.5, (high - low) * .08);
  return { groups, domain: [low - padding, high + padding] as [number, number] };
}
