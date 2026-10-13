import type { BatchSummary } from './types';
export function histogram(values: number[], reference: number, binSize = 1) {
  const minValue = Math.min(reference, ...values), maxValue = Math.max(reference, ...values);
  const min = Math.floor(minValue / binSize) * binSize;
  const max = Math.ceil(maxValue / binSize) * binSize + binSize;
  const domain: [number, number] = [Math.max(0, min), Math.min(100, max)];
  const bins = Math.max(1, Math.ceil((domain[1] - domain[0]) / binSize));
  const width = (domain[1]-domain[0])/bins;
  const counts = Array(bins).fill(0) as number[];
  for (const value of values) counts[Math.min(bins-1, Math.max(0, Math.floor((value-domain[0])/width)))]++;
  return { points: counts.map((y, i) => ({ x: domain[0]+(i+.5)*width, y })), domain, width };
}
export function meanCurves(values: number[], reference: number, points = 80, histogramBinWidth = 1) {
  const minValue = Math.min(reference, ...values), maxValue = Math.max(reference, ...values);
  const empiricalMean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : reference;
  const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - empiricalMean) ** 2, 0) / (values.length - 1) : 1;
  const sd = Math.sqrt(Math.max(variance, 1e-9));
  const padding = Math.max(sd * 3, (maxValue - minValue) * .15, 1);
  const domain: [number, number] = [minValue - padding, maxValue + padding];
  const step = (domain[1] - domain[0]) / (points - 1);
  const bandwidth = Math.max(1e-6, 1.06 * sd * Math.pow(Math.max(values.length, 2), -.2));
  // The theoretical bell is centered on the known population mean, so its
  // midpoint remains aligned with the red reference line while the spread
  // is estimated from the simulated sample means.
  const normal = (x: number) => Math.exp(-.5 * ((x - reference) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  // Histogram uses bins one unit wide. Convert the density back to expected
  // counts per histogram bin instead of multiplying by the fine curve step.
  const empirical = Array.from({ length: points }, (_, i) => {
    const x = domain[0] + i * step;
    const density = values.length ? values.reduce((sum, value) => sum + Math.exp(-.5 * ((x - value) / bandwidth) ** 2), 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI)) : 0;
    return { x, y: density * values.length * histogramBinWidth };
  });
  return { points: empirical, normal: empirical.map(point => ({ x: point.x, y: normal(point.x) * values.length * histogramBinWidth })), domain };
}
export function outsideHistogram(batches: BatchSummary[], category: number, size: number) {
  const counts = new Map<number, number>();
  for (const batch of batches) { const x = batch.categories[category].outside; counts.set(x, (counts.get(x) ?? 0)+1); }
  // Omit zero-height tail bars, keeping the full 0…size axis explicit in the caption.
  const max = Math.max(1, ...counts.keys());
  return { points: Array.from({ length: max+1 }, (_, x) => ({ x, y: counts.get(x) ?? 0 })), domain: [-.5, Math.min(size, max+1)+.5] as [number, number] };
}
export function convergence(batches: BatchSummary[], category: number) {
  let outside = 0, samples = 0;
  const stride = Math.max(1, Math.ceil(batches.length/400));
  return batches.flatMap((batch, i) => {
    outside += batch.categories[category].outside; samples += batch.samples;
    return i % stride === 0 || i === batches.length-1 ? [{ x: batch.index, y: outside/samples*100 }] : [];
  });
}
