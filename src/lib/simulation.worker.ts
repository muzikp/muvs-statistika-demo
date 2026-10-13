import { addSample, confidenceInterval, addSample as addProportionSample, createBatch, createGlobal, mergeBatch, normalQuantile, realizePopulation, sampleWithoutReplacement, seededRandom, validate } from './statistics';
import type { BatchSummary, WorkerCommand, WorkerMessage } from './types';

let paused = false, stopped = false, animationSpeed = 1;
const send = (message: WorkerMessage) => self.postMessage(message);
let wake: (() => void) | undefined;
self.onmessage = async ({ data }: MessageEvent<WorkerCommand>) => {
  if (data.type === 'pause') { paused = true; return; }
  if (data.type === 'resume') { paused = false; wake?.(); return; }
  if (data.type === 'stop') { stopped = true; wake?.(); return; }
  if (data.type === 'speed') { animationSpeed = Math.max(0, Math.min(8, data.speed)); return; }
  if (data.type !== 'start') return;
  try {
    const config = data.config;
    animationSpeed = config.speed ?? 1;
    const animationDelay = () => animationSpeed <= 0 ? 0 : Math.round(250 / animationSpeed);
    const waitForAnimation = () => new Promise(resolve => setTimeout(resolve, animationDelay()));
    const errors = validate(config);
    if (errors.length) throw new Error(errors.join(' '));
    paused = false; stopped = false;
    if (config.mode === 'mean') {
      const random = seededRandom(config.seed);
      const values = config.populationValues?.length === config.N ? config.populationValues : Array.from({ length: config.N }, () => 50 + (random() + random() + random() - 1.5) * 18);
      const zMean = normalQuantile((1 + config.confidence) / 2);
      const global = createGlobal(1);
      const history: BatchSummary[] = [];
      for (let index = 0; index < config.batches; index++) {
        const batch = createBatch(index + 1, 1);
        for (let s = 0; s < config.samplesPerBatch; s++) {
          const chosen = new Set<number>(); const sample: number[] = [];
          while (sample.length < config.n) { const i = Math.floor(random() * values.length); if (!chosen.has(i)) { chosen.add(i); sample.push(values[i]); } }
          const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
          const variance = sample.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sample.length - 1);
          const half = zMean * Math.sqrt(variance / sample.length);
          const truth = values.reduce((a: number, b: number) => a + b, 0) / values.length;
          const c = batch.categories[0]; const outside = truth < mean - half || truth > mean + half;
          c.outside += Number(outside); c.sum += mean; c.widthSum += half * 2; c.min = Math.min(c.min, mean); c.max = Math.max(c.max, mean);
          c.histogram[Math.min(c.histogram.length - 1, Math.max(0, Math.floor((mean / 100) * c.histogram.length)))]++;
          if (batch.samples < 20) c.intervals.push({ low: mean - half, high: mean + half, estimate: mean, outside });
          batch.samples++;
        }
        batch.meanOutsidePerSample = batch.categories[0].outside / batch.samples; mergeBatch(global, batch); history.push(batch); send({ type: 'progress', batch, batches: history, global }); await waitForAnimation();
      }
      send({ type: 'completed', global }); return;
    }
    const population = realizePopulation(config.N, config.categories);
    const counts = population.map(c => c.count);
    const random = seededRandom(config.seed);
    const z = normalQuantile((1 + config.confidence) / 2);
    const global = createGlobal(population.length);
    const history: BatchSummary[] = [];
    // Signal liveness before the first complete batch. On larger configurations
    // the first batch may take a moment, but the UI must never look frozen.
    send({ type: 'progress', global });
    const chunk = Math.max(1, Math.min(25, Math.floor(5000 / config.n)));
    for (let index = 0; index < config.batches; index++) {
      const batch = createBatch(index + 1, population.length);
      while (batch.samples < config.samplesPerBatch) {
        if (paused && !stopped) {
          send({ type: 'paused', global });
          await new Promise<void>(resolve => { wake = resolve; });
          wake = undefined;
        }
        if (stopped) { send({ type: 'stopped', global }); return; }
        const end = Math.min(batch.samples + chunk, config.samplesPerBatch);
        while (batch.samples < end) addSample(batch, sampleWithoutReplacement(counts, config.n, random), population, config, z);

      }
      mergeBatch(global, batch);
      history.push(batch);
      send({ type: 'progress', batch, batches: history, global }); await waitForAnimation();
    }
    send({ type: 'completed', global });
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : 'Simulace selhala.' }); }
};
