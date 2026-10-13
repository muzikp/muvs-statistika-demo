export interface PopulationCategory { id: number; name: string; weight: number; color: string }
export interface RealizedCategory extends PopulationCategory { count: number; proportion: number }
export interface SimulationConfig {
  N: number; n: number; confidence: number; samplesPerBatch: number;
  batches: number; method: 'wilson' | 'wald'; seed: string; categories: PopulationCategory[];
  mode?: 'proportion' | 'mean'; distribution?: 'normal' | 'uniform' | 'lognormal' | 'exponential'; populationValues?: number[]; speed?: number; showForest?: boolean; populationMean?: number;
}
export interface Interval { low: number; high: number; estimate: number; outside: boolean }
export interface CategorySummary {
  outside: number; sum: number; min: number; max: number; widthSum: number;
  histogram: number[]; intervals: Interval[];
}
export interface BatchSummary {
  index: number; samples: number; categories: CategorySummary[]; meanOutsidePerSample: number;
}
export interface GlobalSummary {
  batches: number; samples: number;
  categories: { outside: number; sum: number; widthSum: number; min: number; max: number }[];
}
export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';
export interface SimulationProgress {
  type: 'progress' | 'paused' | 'completed' | 'stopped';
  batch?: BatchSummary; batches?: BatchSummary[]; global: GlobalSummary;
}
export type WorkerCommand = { type: 'start'; config: SimulationConfig } | { type: 'pause' | 'resume' | 'stop' } | { type: 'speed'; speed: number };
export type WorkerMessage = SimulationProgress | { type: 'error'; message: string };
