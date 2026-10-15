<script lang="ts">
  import { t } from '../lib/texts';

  import Help from './Help.svelte';
  import type { SamplingIteration } from '../lib/sampling';
  import { AGE_GROUPS, SEXES } from '../lib/sampling';
  import { number, percent } from '../lib/format';
  let { history, truth, variable, color }: { history: SamplingIteration[]; truth: number; variable: 'apple' | 'minutes'; color: string } = $props();
  const fmt = (value: number) => variable === 'apple' ? percent(value, 1) : t('forest.valueMin', { value: number(value, 1) });
  const domain = $derived.by(() => {
    const intervals = history.flatMap(entry => entry.estimates ? [entry.estimates[variable]] : []);
    const low = Math.min(truth, ...intervals.map(i => i.low)), high = Math.max(truth, ...intervals.map(i => i.high));
    const padding = Math.max((high - low) * .1, variable === 'apple' ? .01 : 20);
    return [Math.max(0, low - padding), variable === 'apple' ? Math.min(1, high + padding) : high + padding];
  });
  const position = (value: number) => (value - domain[0]) / (domain[1] - domain[0] || 1) * 100;
</script>

<section class="sample-forest" aria-label={t('forest.intervalovyLesVariableapplepodl', { variableApplePodL: variable === 'apple' ? t('forest.podilApple') : t('forest.casNaInternetu') })}>
  <div class="sample-forest-head"><h4>{t('forest.intervalovyLes')}<Help topic="forest" /></h4><span>{history.length} {t('forest.vyberuVsechnyIntervaly')}</span></div>
  <p class="sample-forest-truth">{t('forest.carkovanaCaraSkutecnaHodnota')} <strong>{fmt(truth)}</strong></p>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region must be focusable for keyboard scrolling.) -->
  <div class="sample-forest-scroll" tabindex="0" role="region" aria-label={t('forest.vsechnyVyberyPosouvejteProDalsiIntervaly')}>
    <div class="sample-axis" aria-hidden="true"><span></span><div>{#each [0, .5, 1] as tick}{@const value = domain[0] + tick * (domain[1] - domain[0])}<span style={`left:${tick * 100}%`}>{fmt(value)}</span>{/each}</div><span>{t('forest.odhadAMeze')}</span></div>
    {#each history as entry (entry.iteration)}
      {@const interval = entry.estimates?.[variable]}
      <div class="sample-forest-row" class:missed={interval?.outside} title={interval ? t('forest.vyberEntryiterationIntervalestimateIntervalIntervallowAzIntervalhighIntervaloutsideneobsahujeskute', { entryIteration: entry.iteration, intervalEstimate: fmt(interval.estimate), intervalLow: fmt(interval.low), intervalHigh: fmt(interval.high), intervalOutsideNeobsahujeSkute: interval.outside ? t('forest.neobsahujeSkutecnouHodnotu') : t('forest.obsahujeSkutecnouHodnotu') }) : t('forest.vyberEntryiterationNelzeOdhadnoutNedostatecneSkupinyEntryinsufficient', { entryIteration: entry.iteration, entryInsufficient: entry.insufficient.map(h => `${AGE_GROUPS[Math.floor(h / 2)]} ${SEXES[h % 2]}`).join(', ') })}>
        <span class="sample-index">#{entry.iteration}</span>
        <div class="sample-track">
          <span class="sample-truth-line" style={`left:${position(truth)}%`}></span>
          {#if interval}<span class="sample-range" style={`left:${position(interval.low)}%;width:${position(interval.high) - position(interval.low)}%;--interval-color:${interval.outside ? '#c34e4e' : color}`}><i></i><i></i></span><span class="sample-dot" class:sample-cross={interval.outside} style={`left:${position(interval.estimate)}%;--interval-color:${interval.outside ? '#c34e4e' : color}`}>{interval.outside ? '×' : ''}</span>
          {:else}<span class="sample-unavailable">{t('forest.nelzeOdhadnout')}</span>{/if}
        </div>
        <span class="sample-values">{#if interval}<strong>{fmt(interval.estimate)}</strong><small>{fmt(interval.low)} – {fmt(interval.high)}</small>{:else}<small>{t('forest.nedostatekOsobVeSkupine')}</small>{/if}</span>
      </div>
    {/each}
  </div>
  <p class="sample-forest-note">{t('forest.bodOdhadUseckaIntervalCervenyKrizekMimoSkutecnost')}</p>
</section>

<style>
  .sample-forest{margin-top:24px}.sample-forest-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.sample-forest-head h4{font-size:16px;margin:0}.sample-forest-head>span{font-size:11px;color:#607f91}.sample-forest-truth,.sample-forest-note{font-size:11px;line-height:1.7;color:#607f91;margin:10px 0}.sample-axis,.sample-forest-row{display:grid;grid-template-columns:48px minmax(0,1fr) 145px;gap:15px;align-items:center}.sample-axis{height:32px;font-size:10px;color:#607f91;padding-right:0;position:sticky;top:0;z-index:2;background:#fbfdff;border-bottom:1px solid #d5e5ef}.sample-axis>div{position:relative;height:22px;margin-inline:5px}.sample-axis>div>span{position:absolute;top:3px;transform:translateX(-50%);white-space:nowrap}.sample-axis>span:last-child{text-align:right}.sample-forest-scroll{height:420px;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;border:1px solid #d5e5ef;background:#fbfdff;padding-inline:8px}.sample-forest-scroll:focus-visible{outline:3px solid #c34e4e;outline-offset:3px}.sample-forest-row{height:46px;border-bottom:1px solid #e8eee2}.sample-index{font:10px 'DM Mono',monospace;color:#607f91}.sample-track{height:100%;position:relative;margin-inline:5px}.sample-truth-line{position:absolute;top:0;bottom:0;border-left:2px dashed #477fa8;opacity:.85}.sample-range{position:absolute;height:3px;background:var(--interval-color);top:50%;transform:translateY(-50%)}.sample-range i{position:absolute;height:12px;top:-4px;border-left:2px solid var(--interval-color)}.sample-range i:first-child{left:0}.sample-range i:last-child{right:0}.sample-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:var(--interval-color)}.sample-dot.sample-cross{background:transparent;border-radius:0;width:auto;height:auto;color:var(--interval-color);font-size:22px;line-height:1}.sample-values{text-align:right;font-size:11px;white-space:nowrap}.sample-values strong{font-weight:600}.sample-values small{display:block;font-size:9px;color:#607f91;margin-top:3px}.missed .sample-values strong{color:#c34e4e}.sample-unavailable{position:absolute;top:50%;transform:translateY(-50%);font-size:10px;color:#c34e4e}.sample-forest-note{margin-bottom:0}@media(max-width:600px){.sample-axis,.sample-forest-row{grid-template-columns:34px minmax(0,1fr) 105px;gap:6px}.sample-values{font-size:10px}.sample-values small{font-size:8px}.sample-axis{font-size:9px}.sample-forest-head{align-items:start}.sample-forest-head>span{font-size:10px}.sample-forest-scroll{padding-inline:5px}}
</style>
