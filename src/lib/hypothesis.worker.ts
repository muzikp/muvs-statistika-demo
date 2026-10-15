import { createHypothesisPopulation, hypothesisSampler, validateHypothesis, type HypothesisConfig, type HypothesisIteration, type HypothesisMessage, type HypothesisPopulation, type HypothesisSpec } from './hypothesis';
import { t } from './texts';

let population: HypothesisPopulation | null = null, busy = false, paused = false, speed = 4;
const send = (message: HypothesisMessage) => self.postMessage(message);
const generate = (spec: HypothesisSpec, requestId?: number) => {
  population = createHypothesisPopulation(spec, (completed, total) => send({ type: 'population-progress', completed, total, requestId }));
  send({ type: 'population-ready', population: population.summary, requestId }); return population;
};
type Command = { type: 'preview'; requestId: number; config: HypothesisConfig; draw: number } | { type: 'generate'; requestId: number; spec: HypothesisSpec } | { type: 'simulate'; config: HypothesisConfig; speed: number } | { type: 'pause' | 'resume' } | { type: 'speed'; speed: number };
self.onmessage = async ({ data }: MessageEvent<Command>) => {
  if (data.type === 'pause') { paused = true; return; }
  if (data.type === 'resume') { paused = false; return; }
  if (data.type === 'speed') { speed = Math.max(0, Math.min(8, data.speed)); return; }
  if (busy) return;
  busy = true;
  try {
    if (data.type === 'generate') { generate(data.spec, data.requestId); return; }
    if (data.type !== 'simulate' && data.type !== 'preview') return;
    const config = data.config, errors = validateHypothesis(config);
    if (errors.length) throw Error(errors[0]);
    const requestId = data.type === 'preview' ? data.requestId : undefined;
    const current = population && JSON.stringify(population.summary.spec) === JSON.stringify(config.population) ? population : generate(config.population, requestId);
    if (data.type === 'preview') {
      const { entry } = hypothesisSampler(current, config, true)(data.draw);
      send({ type: 'preview-ready', config, population: current.summary, entry, requestId }); return;
    }
    speed = data.speed; paused = false;
    const sample = hypothesisSampler(current, config);
    let entries: HypothesisIteration[] = [], lastSent = performance.now();
    for (let i = 0; i < config.repeats; i++) {
      while (paused) await new Promise(resolve => setTimeout(resolve, 40));
      const { entry } = sample(i); entries.push(entry);
      const final = i === config.repeats - 1;
      if (final || speed > 0 || performance.now() - lastSent > 100) {
        send({ type: final ? 'completed' : 'progress', entries }); entries = []; lastSent = performance.now();
      }
      if (final) break;
      // Yield even without animation so pause and speed changes remain responsive.
      if (speed > 0 || (i + 1) % 20 === 0) await new Promise(resolve => setTimeout(resolve, speed > 0 ? Math.round(100 / speed) : 0));
    }
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : t('hypothesis.workerError'), requestId: data.type === 'preview' || data.type === 'generate' ? data.requestId : undefined }); }
  finally { busy = false; }
};
