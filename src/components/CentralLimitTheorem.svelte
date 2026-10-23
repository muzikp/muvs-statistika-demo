<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/texts';
  import { loadPreferences, savePreferences } from '../lib/preferences';
  import Plot from './Plot.svelte';

  type Distribution = 'bernoulli' | 'uniform' | 'normal' | 'lognormal' | 'exponential';
  let distribution = $state<Distribution>('bernoulli');
  let sampleSize = $state(30);
  let repetitions = $state(1000);
  let probability = $state(50);
  let mean = $state(50);
  let sd = $state(10);
  let seed = $state('centralni-limitni-veta');
  let preferencesLoaded = $state(false);
  let values = $state<number[]>([]);
  let running = $state(false);
  let progress = $state(0);
  let total = $state(0);
  $effect(() => { if (preferencesLoaded) savePreferences('clt', { distribution, sampleSize, repetitions, probability, mean, sd, seed }); });
  onMount(() => {
    const saved = loadPreferences<Partial<{ distribution: Distribution; sampleSize: number; repetitions: number; probability: number; mean: number; sd: number; seed: string }>>('clt', {});
    if (['bernoulli', 'uniform', 'normal', 'lognormal', 'exponential'].includes(saved.distribution ?? '')) distribution = saved.distribution!;
    if (Number.isFinite(saved.sampleSize)) sampleSize = saved.sampleSize!;
    if (Number.isFinite(saved.repetitions)) repetitions = saved.repetitions!;
    if (Number.isFinite(saved.probability)) probability = saved.probability!;
    if (Number.isFinite(saved.mean)) mean = saved.mean!;
    if (Number.isFinite(saved.sd)) sd = saved.sd!;
    if (typeof saved.seed === 'string') seed = saved.seed;
    preferencesLoaded = true;
  });
  const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  const rng = (s: { value: number }) => { s.value = (1664525 * s.value + 1013904223) >>> 0; return s.value / 4294967296; };
  const normal = (s: { value: number }) => { const u = Math.max(Number.EPSILON, rng(s)); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng(s)); };
  const source = (s: { value: number }) => {
    if (distribution === 'bernoulli') return rng(s) < Number(probability) / 100 ? 1 : 0;
    if (distribution === 'uniform') return rng(s);
    if (distribution === 'normal') return Number(mean) + Number(sd) * normal(s);
    if (distribution === 'lognormal') return Math.exp(Number(mean) / 10 + Math.max(0, Number(sd) / 10) * normal(s));
    return -Math.log(Math.max(Number.EPSILON, 1 - rng(s))) * Math.max(0.01, Number(mean) / 10);
  };
  async function run() {
    if (running) return;
    running = true; progress = 0;
    const state = { value: hash(seed) }; const n = Math.max(1, Math.min(10000, Math.round(Number(sampleSize) || 1))); const r = Math.max(2, Math.min(1000000, Math.round(Number(repetitions) || 2)));
    total = r; const out: number[] = []; values = [];
    const chunk = r > 100000 ? 5000 : 1000;
    for (let start = 0; start < r; start += chunk) {
      const end = Math.min(r, start + chunk);
      for (let i = start; i < end; i += 1) { let sum = 0; for (let j = 0; j < n; j += 1) sum += source(state); out.push(sum / n); }
      // Keep the chart responsive for very large R. The simulation still
      // runs through every repetition, while the histogram needs at most
      // 100k representative points to look identical at screen resolution.
      const displayStep = Math.max(1, Math.ceil(out.length / 100000));
      values = out.filter((_, index) => index % displayStep === 0).slice(0, 100000);
      progress = end;
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    running = false;
  }
  const reference = $derived(distribution === 'bernoulli' ? Number(probability) / 100 : distribution === 'uniform' ? .5 : distribution === 'lognormal' ? Math.exp(Number(mean) / 10 + (Number(sd) / 10) ** 2 / 2) : distribution === 'exponential' ? Number(mean) / 10 : Number(mean));
  const chart = $derived.by(() => { if (!values.length) return null; const lo = Math.min(...values), hi = Math.max(...values); const targetBins = Math.min(80, Math.max(12, Math.ceil(8 * Math.cbrt(Math.max(2, total))))); const width = Math.max((hi - lo) / targetBins, 0.001); const min = Math.floor(lo / width) * width, max = Math.ceil(hi / width) * width + width; const bins = Math.max(1, Math.ceil((max - min) / width)); const counts = Array(bins).fill(0) as number[]; values.forEach(v => counts[Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)))]++); const m = values.reduce((a,b)=>a+b,0)/values.length; const s = Math.sqrt(values.reduce((a,b)=>a+(b-m)**2,0)/Math.max(1,values.length-1)); const curve = Array.from({length:81},(_,i)=>{const x=min+(max-min)*i/80; return {x,y:s?Math.exp(-.5*((x-m)/s)**2)/(s*Math.sqrt(2*Math.PI))*values.length*width:0};}); return { points: counts.map((y,i)=>({x:min+(i+.5)*width,y})), curve, domain:[min,max] as [number,number], width }; });
</script>
<section class="clt-card"><div class="clt-intro"><p class="eyebrow">{t('clt.eyebrow')}</p><h2>{t('clt.title')}</h2><p>{t('clt.intro')}</p></div>
  <div class="clt-settings"><label>{t('clt.distribution')}<select bind:value={distribution}><option value="bernoulli">{t('clt.bernoulli')}</option><option value="uniform">{t('clt.uniform')}</option><option value="normal">{t('clt.normal')}</option><option value="lognormal">{t('clt.lognormal')}</option><option value="exponential">{t('clt.exponential')}</option></select></label><label>{t('clt.sampleSize')}<input type="number" min="1" max="10000" bind:value={sampleSize} /></label><label>{t('clt.repetitions')}<input type="number" min="2" max="1000000" bind:value={repetitions} /></label>{#if distribution === 'bernoulli'}<label>{t('clt.probability')}<input type="number" min="0" max="100" bind:value={probability} /></label>{:else}<label>{t('clt.mean')}<input type="number" step="1" bind:value={mean} /></label><label>{t('clt.sd')}<input type="number" min="0.01" step="1" bind:value={sd} /></label>{/if}<label>{t('clt.seed')}<input bind:value={seed} /></label></div>
  <div class="clt-actions"><button class="button primary" type="button" disabled={running} onclick={run}>{running ? t('clt.running') : t('clt.run')}</button>{#if total}<span>{progress.toLocaleString('cs-CZ')} / {total.toLocaleString('cs-CZ')}</span><progress max={total} value={progress}></progress>{/if}</div>
  {#if chart}<section class="clt-chart"><h3>{t('clt.chartTitle')}</h3><p>{t('clt.chartNote')}</p><Plot points={chart.points} secondaryPoints={chart.curve} secondaryColor="#c34e4e" kind="bar" color="#397ec1" barOpacity={.55} barWidth={chart.width} domain={chart.domain} reference={reference} referenceLabel={t('clt.reference')} currentSample={progress} totalSamples={total} title={t('clt.chartTitle')} xLabel={t('clt.axis')} yLabel={t('clt.count')} /><p class="clt-reading">{t('clt.readingNote')}</p></section>{:else}<p class="sampling-note">{t('clt.empty')}</p>{/if}
</section>
<style>.clt-card{background:#fff;border:1px solid var(--line);padding:26px}.clt-intro{max-width:760px}.clt-intro h2{font-size:28px;margin:0 0 10px}.clt-intro p:not(.eyebrow){color:#607f91;line-height:1.7}.clt-settings{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 16px;margin:24px 0}.clt-settings label{display:block;color:#4e7085;font-size:12px}.clt-settings input,.clt-settings select{display:block;width:100%;box-sizing:border-box;border:1px solid #cbdce8;border-radius:4px;background:#fbfdff;color:var(--ink);padding:10px;margin-top:6px}.clt-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.clt-actions progress{flex:1;min-width:180px;accent-color:#397ec1}.clt-chart{border-top:1px solid var(--line);margin-top:22px;padding-top:22px}.clt-chart p{font-size:12px;color:#607f91}.clt-reading{padding:12px;background:#f4f8fb;border:1px solid #dce8f0}@media(max-width:760px){.clt-settings{grid-template-columns:1fr}.clt-card{padding:18px}}</style>
