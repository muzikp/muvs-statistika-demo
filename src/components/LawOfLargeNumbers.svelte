<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/texts';
  import { loadPreferences, savePreferences } from '../lib/preferences';
  import Plot from './Plot.svelte';
  import Help from './Help.svelte';

  type Mode = 'binary' | 'continuous';
  let mode = $state<Mode>('binary');
  let trials = $state(1000);
  let probability = $state(50);
  let mean = $state(50);
  let sd = $state(10);
  let tolerance = $state(2);
  let seed = $state('velka-cisla');
  let preferencesLoaded = $state(false);
  let points = $state<{ x: number; y: number }[]>([]);
  let running = $state(false);
  let stabilizedAt = $state<number | null>(null);
  $effect(() => { if (preferencesLoaded) savePreferences('law', { mode, trials, probability, mean, sd, tolerance, seed }); });
  onMount(() => {
    const saved = loadPreferences<Partial<{ mode: Mode; trials: number; probability: number; mean: number; sd: number; tolerance: number; seed: string }>>('law', {});
    if (saved.mode === 'binary' || saved.mode === 'continuous') mode = saved.mode;
    if (Number.isFinite(saved.trials)) trials = saved.trials!;
    if (Number.isFinite(saved.probability)) probability = saved.probability!;
    if (Number.isFinite(saved.mean)) mean = saved.mean!;
    if (Number.isFinite(saved.sd)) sd = saved.sd!;
    if (Number.isFinite(saved.tolerance)) tolerance = saved.tolerance!;
    if (typeof saved.seed === 'string') seed = saved.seed;
    preferencesLoaded = true;
  });

  const hashSeed = (value: string) => Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
  function random(seedState: { value: number }) { seedState.value = (1664525 * seedState.value + 1013904223) >>> 0; return seedState.value / 4294967296; }
  function normal(seedState: { value: number }) { const u = Math.max(Number.EPSILON, random(seedState)), v = random(seedState); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function run() {
    running = true;
    const state = { value: hashSeed(seed) };
    const result: { x: number; y: number }[] = [];
    let sum = 0;
    const count = Math.max(1, Math.min(100000, Math.round(Number(trials) || 1)));
    for (let i = 1; i <= count; i += 1) {
      sum += mode === 'binary' ? Number(random(state) < Math.max(0, Math.min(100, Number(probability))) / 100) * 100 : Number(mean) + Number(sd) * normal(state);
      result.push({ x: i, y: sum / i });
    }
    points = result;
    const stableWindow = Math.min(100, Math.max(20, Math.floor(count / 10)));
    stabilizedAt = null;
    for (let i = 0; i <= result.length - stableWindow; i += 1) {
      if (result.slice(i, i + stableWindow).every(point => Math.abs(point.y - (mode === 'binary' ? Number(probability) : Number(mean))) <= Number(tolerance))) { stabilizedAt = result[i].x; break; }
    }
    running = false;
  }

  const reference = $derived(mode === 'binary' ? Number(probability) : Number(mean));
  const yLabel = $derived(mode === 'binary' ? t('law.axisBinary') : t('law.axisContinuous'));
  const sigma = $derived(mode === 'binary' ? Math.sqrt((Number(probability) / 100) * (1 - Number(probability) / 100)) * 100 : Number(sd));
  const funnel = $derived(points.map(point => ({ x: point.x, y: reference + 1.96 * sigma / Math.sqrt(point.x) })));
  const funnelLower = $derived(points.map(point => ({ x: point.x, y: Math.max(0, reference - 1.96 * sigma / Math.sqrt(point.x)) })));
  const toleranceUpper = $derived(points.map(point => ({ x: point.x, y: reference + Number(tolerance) })));
  const toleranceLower = $derived(points.map(point => ({ x: point.x, y: Math.max(0, reference - Number(tolerance)) })));
  const currentDeviation = $derived(points.length ? Math.abs(points[points.length - 1].y - reference) : 0);
  const currentSe = $derived(points.length ? sigma / Math.sqrt(points.length) : 0);
</script>

<section class="law-card">
  <div class="law-intro"><p class="eyebrow">{t('law.eyebrow')}</p><h2>{t('law.title')}</h2><p>{t('law.intro')}</p></div>
  <div class="law-settings">
    <label>{t('law.variableType')}<Help topic="lawVariableType" /><select bind:value={mode}><option value="binary">{t('law.binary')}</option><option value="continuous">{t('law.continuous')}</option></select></label>
    <label>{t('law.trials')}<Help topic="lawTrials" /><input type="number" min="1" max="100000" step="100" bind:value={trials} /></label>
    {#if mode === 'binary'}
      <label>{t('law.probability')}<Help topic="lawProbability" /><input type="number" min="0" max="100" step="1" bind:value={probability} /> <small>{t('law.percentUnit')}</small></label>
    {:else}
      <label>{t('law.mean')}<Help topic="lawMean" /><input type="number" step="1" bind:value={mean} /></label>
      <label>{t('law.sd')}<Help topic="lawSd" /><input type="number" min="0" step="1" bind:value={sd} /></label>
    {/if}
    <label>{t('law.tolerance')}<Help topic="lawTolerance" /><input type="number" min="0.01" step="0.5" bind:value={tolerance} /></label><label>{t('law.seed')}<Help topic="lawSeed" /><input bind:value={seed} /></label>
  </div>
  <div class="law-actions"><button class="button primary" type="button" disabled={running} onclick={run}>{t('law.run')}</button><span>{t('law.reference')}: <strong>{reference.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}{mode === 'binary' ? ' %' : ''}</strong></span></div>
  {#if points.length}
    <section class="law-chart"><h3>{t('law.chartTitle')}<Help topic="lawFunnel" /></h3><p>{t('law.chartNote')}</p><div class="law-metrics"><div><span>{t('law.currentDeviation')}<Help topic="lawCurrentDeviation" /></span><strong>{currentDeviation.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}</strong></div><div><span>{t('law.expectedSe')}<Help topic="lawExpectedSe" /></span><strong>{currentSe.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}</strong></div><div><span>{t('law.stabilizedAt')}<Help topic="lawStabilizedAt" /></span><strong>{stabilizedAt ? stabilizedAt.toLocaleString('cs-CZ') : '—'}</strong></div></div><Plot points={points} bandUpper={funnel} bandLower={funnelLower} bandLabel={t('law.funnelLegend')} lineUpper={toleranceUpper} lineLower={toleranceLower} domain={[1, points.length]} reference={reference} referenceLabel={t('law.reference')} horizontal kind="line" color="#397ec1" outsideColor="#c34e4e" title={t('law.chartTitle')} xLabel={t('law.trialsAxis')} yLabel={yLabel} /></section>
  {:else}<p class="sampling-note">{t('law.empty')}</p>{/if}
</section>

<style>
  .law-card{background:#fff;border:1px solid var(--line);padding:26px}.law-intro{max-width:760px}.law-intro h2{font-size:28px;margin:0 0 10px}.law-intro p:not(.eyebrow){color:#607f91;line-height:1.7}.law-settings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 16px;margin-top:24px}.law-settings label{display:block;color:#4e7085;font-size:12px}.law-settings input,.law-settings select{display:block;width:100%;box-sizing:border-box;border:1px solid #cbdce8;border-radius:4px;background:#fbfdff;color:var(--ink);padding:10px;margin-top:6px}.law-settings small{font-size:10px}.law-actions{display:flex;align-items:center;gap:20px;margin:22px 0}.law-actions strong{font-family:'DM Mono',monospace;color:#2f6484}.law-chart{border-top:1px solid var(--line);padding-top:22px}.law-chart h3{margin:0 0 7px}.law-chart p{font-size:12px;color:#607f91}.law-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.law-metrics div{background:#f4f8fb;border:1px solid #dce8f0;padding:12px}.law-metrics span{display:block;font-size:10px;color:#607f91}.law-metrics strong{display:block;margin-top:7px;font:17px 'DM Mono',monospace;color:#2f6484}.law-chart :global(.plot-wrap){margin-top:12px}@media(max-width:760px){.law-settings{grid-template-columns:1fr}.law-card{padding:18px}.law-actions{display:block}.law-actions button{margin-bottom:12px}.law-metrics{grid-template-columns:1fr}}
</style>
