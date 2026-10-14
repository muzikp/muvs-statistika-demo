import { expect, it } from 'vitest';
import { hypothesisMeanCurves } from './hypothesis-plots';

it('centers curves on the current estimates, includes population means and normalizes density', () => {
  const plot = hypothesisMeanCurves({ meanA: 60, meanB: 65, seA: 1, seB: 2 }, { groups: [{ mean: 40, sd: 10 }, { mean: 80, sd: 12 }] });
  expect(plot.domain[0]).toBeLessThan(40); expect(plot.domain[1]).toBeGreaterThan(80);
  plot.groups.forEach((group, g) => {
    const peak = group.points.reduce((best, point) => best.y > point.y ? best : point);
    expect(peak.x).toBe(g ? 65 : 60);
    expect(peak.y).toBeCloseTo(1 / (group.se * Math.sqrt(2 * Math.PI)), 12);
    const dx = group.points[1].x - group.points[0].x;
    expect(group.points.reduce((sum, point, i) => sum + point.y * dx * (i === 0 || i === group.points.length - 1 ? .5 : 1), 0)).toBeCloseTo(1, 4);
  });
});
it('shows lower uncertainty as a narrower and taller curve without shifting its mean', () => {
  const population = { groups: [{ mean: 60, sd: 10 }, { mean: 65, sd: 12 }] };
  const wide = hypothesisMeanCurves({ meanA: 61, meanB: 66, seA: 2, seB: 3 }, population);
  const narrow = hypothesisMeanCurves({ meanA: 61, meanB: 66, seA: 1, seB: 1.5 }, population);
  narrow.groups.forEach((group, g) => {
    expect(group.points.at(-1)!.x - group.points[0].x).toBeCloseTo((wide.groups[g].points.at(-1)!.x - wide.groups[g].points[0].x) / 2, 10);
    expect(Math.max(...group.points.map(point => point.y))).toBeCloseTo(2 * Math.max(...wide.groups[g].points.map(point => point.y)), 10);
    expect(group.mean).toBe(wide.groups[g].mean);
  });
});
it('handles a degenerate group without inventing a normal density or invalid coordinates', () => {
  const plot = hypothesisMeanCurves({ meanA: 60, meanB: 60, seA: 0, seB: 0 }, { groups: [{ mean: 60, sd: 0 }, { mean: 60, sd: 0 }] });
  expect(plot.groups.every(group => group.points.length === 0)).toBe(true);
  expect(plot.domain[0]).toBeLessThan(60); expect(plot.domain[1]).toBeGreaterThan(60);
});
