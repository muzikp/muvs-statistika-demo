<script lang="ts">
  import { t } from '../lib/texts';
  import { number } from '../lib/format';
  import Help from './Help.svelte';
  import type { HypothesisIteration } from '../lib/hypothesis';
  let { history, truth, nullDifference }: { history: HypothesisIteration[]; truth: number; nullDifference: number } = $props();
  let scrollTop = $state(0);
  const domain = $derived.by(() => {
    let low = Math.min(truth, nullDifference), high = Math.max(truth, nullDifference);
    for (const { result } of history) if (result) { low = Math.min(low, Number.isFinite(result.low) ? result.low : result.difference); high = Math.max(high, Number.isFinite(result.high) ? result.high : result.difference); }
    const padding = Math.max(1, (high - low) * .1); return [low - padding, high + padding];
  });
  const start = $derived(Math.max(0, Math.floor(scrollTop / 48) - 3));
  const visible = $derived(history.slice(start, start + 18));
  const position = (value: number) => Math.max(0, Math.min(100, (value - domain[0]) / (domain[1] - domain[0]) * 100));
  const bound = (value: number) => Number.isFinite(value) ? number(value, 2) : value < 0 ? '−∞' : '+∞';
</script>

<section class="hyp-forest">
  <h3>{t('hypothesis.forest')}<Help topic="hypForest" /></h3><p>{t('hypothesis.forestNote')}</p>
  <div class="axis"><span></span><div>{#each [0, .5, 1] as tick}<span style:left={`${tick * 100}%`}>{number(domain[0] + tick * (domain[1] - domain[0]), 1)}</span>{/each}</div><span>{t('hypothesis.pValue')}</span></div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable interval history supports keyboard navigation.) -->
  <div class="viewport" role="region" tabindex="0" aria-label={t('hypothesis.forest')} onscroll={event => { scrollTop = event.currentTarget.scrollTop; }}>
    <div style:height={`${history.length * 48}px`} class="canvas">
      {#each visible as entry (entry.iteration)}
        {@const r = entry.result}
        <div class="row" style:top={`${(entry.iteration - 1) * 48}px`} class:missed={r?.outside} title={r ? t('hypothesis.forestRow', { iteration: entry.iteration, difference: number(r.difference, 2), low: bound(r.low), high: bound(r.high), p: r.p.toPrecision(4), decision: r.reject ? t('hypothesis.reject') : t('hypothesis.retain') }) : t('hypothesis.invalidCurrent')}>
          <span class="index">#{entry.iteration}</span><div class="track"><i class="truth" style:left={`${position(truth)}%`}></i><i class="null" style:left={`${position(nullDifference)}%`}></i>
            {#if r}<span class="range" style:left={`${position(r.low)}%`} style:width={`${position(r.high) - position(r.low)}%`}>{#if !Number.isFinite(r.low)}<b class="left">←</b>{/if}{#if !Number.isFinite(r.high)}<b class="right">→</b>{/if}</span><i class="dot" style:left={`${position(r.difference)}%`}></i>{:else}<small>{t('simulator.nelzeOdhadnout')}</small>{/if}
          </div><span class="value">{#if r}<strong>{number(r.difference, 2)} <small>⟨{bound(r.low)}; {bound(r.high)}⟩</small></strong><small>p = {r.p < .0001 ? r.p.toExponential(1) : number(r.p, 4)} · {r.reject ? t('hypothesis.reject') : t('hypothesis.retain')}</small>{:else}—{/if}</span>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  h3{font-size:17px}p{font-size:12px;line-height:1.8;color:#607f91}.viewport{height:420px;overflow:auto;scrollbar-gutter:stable;border:1px solid #d5e5ef;background:#fbfdff;padding:0 12px}.viewport:focus-visible{outline:3px solid #c34e4e}.canvas{position:relative}.row,.axis{display:grid;grid-template-columns:50px minmax(0,1fr) 230px;gap:15px;align-items:center}.row{position:absolute;left:0;right:0;height:48px;border-bottom:1px solid #dce8f0}.axis{padding:10px 24px 10px 12px;font-size:11px;color:#607f91}.axis>div{position:relative;height:15px}.axis>div>span{position:absolute;transform:translateX(-50%)}.track{position:relative;height:48px;margin:0 4px}.truth,.null{position:absolute;top:0;bottom:0;border-left:1px dashed #397ec1}.null{border-left:2px dotted #c34e4e}.range{position:absolute;top:23px;height:2px;background:#397ec1}.dot{position:absolute;top:20px;width:8px;height:8px;border-radius:50%;background:#397ec1;transform:translateX(-50%)}.missed .range,.missed .dot{background:#c34e4e}.range b{position:absolute;top:-8px;font-size:14px}.left{left:0}.right{right:0}.index{font:10px 'DM Mono',monospace;color:#607f91}.value{font-size:11px;text-align:right}.value strong,.value>small{display:block}.value strong small{font-weight:400}.value>small{font-size:9px;color:#607f91;margin-top:4px}.track>small{position:absolute;top:15px;font-size:10px}@media(max-width:650px){.row,.axis{grid-template-columns:38px minmax(0,1fr) 130px;gap:8px}.value{font-size:9px}.value>small{font-size:8px}.value strong small{display:block}}
</style>
