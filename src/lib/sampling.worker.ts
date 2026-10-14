import { t } from './texts';
import { addResult, simulateOnce, convenienceCDF, createPopulation, createSummary, stratifiedAllocation, validateSampling } from './sampling';
import type { SamplingCommand, SamplingMessage, SamplingIteration } from './sampling';

let paused = false, busy = false, speed = 1;
const send = (message: SamplingMessage) => self.postMessage(message);
const populationProgress = (completed: number, total: number) => send({ type: 'population-progress', completed, total });
self.onmessage = async ({ data }: MessageEvent<SamplingCommand>) => {
  if (data.type === 'generate') {
    if (busy) return;
    busy = true;
    try { send({ type: 'population-ready', population: createPopulation(data.spec, populationProgress) }); }
    catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
    finally { busy = false; }
    return;
  }
  if (data.type === 'pause') { paused = true; return; }
  if (data.type === 'resume') { paused = false; return; }
  if (data.type === 'speed') { speed = Number.isFinite(data.speed) ? Math.max(0, Math.min(8, data.speed)) : 1; return; }
  if (data.type !== 'simulate' || busy) return;
  busy = true; paused = false;
  speed = Number.isFinite(data.speed) ? Math.max(0, Math.min(8, data.speed)) : 1;
  try {
    const config = data.config, errors = validateSampling(config);
    if (errors.length) throw new Error(errors[0]);
    const population = createPopulation(config.population, populationProgress), summary = createSummary()[config.method], history: SamplingIteration[] = [];
    const allocation = config.method === 'stratified' ? stratifiedAllocation(population.cells.map(cell => cell.length), config.n) : [];
    const cdf = config.method === 'convenience' || config.method === 'weighted' ? convenienceCDF(population, config.demographicBias, config.outcomeBias) : [];
    for (let iteration = 0; iteration < config.repeats; iteration++) {
      if (paused) {
        send({ type: 'paused', completed: iteration, summary, history });
        while (paused) await new Promise(resolve => setTimeout(resolve, 40));
      }
      const result = simulateOnce(population, config, iteration, cdf, allocation);
      addResult(summary, result, population);
      history.push({ iteration: iteration + 1, estimates: result.estimates, insufficient: result.insufficient, sample: { counts: result.counts, weights: result.weights, effectiveN: result.effectiveN } });
      // Bound rendering and message volume while keeping the simulation visible.
      if (speed > 0 || (iteration + 1) % 20 === 0 || iteration === config.repeats - 1) {
        send({ type: 'progress', completed: iteration + 1, summary, history });
        await new Promise(resolve => setTimeout(resolve, speed > 0 ? Math.round(100 / speed) : 0));
      }
    }
    send({ type: 'completed', completed: config.repeats, summary, history });
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
  finally { busy = false; }
};
