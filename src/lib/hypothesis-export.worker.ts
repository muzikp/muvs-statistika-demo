import { exportHypothesis } from './hypothesis-export';
import type { HypothesisConfig, HypothesisIteration, HypothesisPopulationSummary } from './hypothesis';
self.onmessage = async ({ data }: MessageEvent<{ population: HypothesisPopulationSummary; config: HypothesisConfig; history: HypothesisIteration[] }>) => {
  try {
    const buffer = await exportHypothesis(data.population, data.config, data.history, completed => self.postMessage({ type: 'progress', completed }));
    self.postMessage({ type: 'ready', buffer }, { transfer: [buffer] });
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
