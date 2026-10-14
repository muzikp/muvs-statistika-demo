<script lang="ts">
  import { t } from '../lib/texts';
  import { number } from '../lib/format';
  import Help from './Help.svelte';
  import type { HypothesisPopulationSummary, TestResult } from '../lib/hypothesis';
  let { population, current, averages }: { population: HypothesisPopulationSummary; current: TestResult | null; averages?: { average: number | null; averageA: number | null; averageB: number | null; averageD: number | null } } = $props();
  const rows = $derived([
    { id: 'meanA', label: t('hypothesis.comparisonMeanA'), truth: population.groups[0].mean, current: current?.meanA ?? null, average: averages?.averageA ?? null, effect: false },
    { id: 'meanB', label: t('hypothesis.comparisonMeanB'), truth: population.groups[1].mean, current: current?.meanB ?? null, average: averages?.averageB ?? null, effect: false },
    { id: 'difference', label: t('hypothesis.comparisonDifference'), truth: population.truth, current: current?.difference ?? null, average: averages?.average ?? null, effect: false },
    { id: 'cohensD', label: t('hypothesis.cohensD'), truth: population.cohensD, current: current?.cohensD ?? null, average: averages?.averageD ?? null, effect: true }
  ]);
  const fmt = (value: number | null, effect: boolean, signed = false) => value === null ? '—' : `${signed && value > 0 ? '+' : ''}${number(value, effect ? 3 : 2)}${effect ? '' : ` ${t('simulator.min')}`}`;
</script>
<h3>{t('hypothesis.comparison')}<Help topic="hypComparison" /></h3>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table supports keyboard navigation.) -->
<div class="comparison-scroll" role="region" aria-label={t('hypothesis.comparison')} tabindex="0">
  <table class="population-comparison"><thead><tr><th scope="col">{t('hypothesis.comparisonMetric')}</th><th scope="col">{t('hypothesis.comparisonPopulation')}</th><th scope="col">{averages ? t('hypothesis.comparisonSample') : t('hypothesis.previewSample')}</th>{#if averages}<th scope="col">{t('hypothesis.comparisonAverage')}</th>{/if}<th scope="col">{t('hypothesis.comparisonError')}</th></tr></thead>
    <tbody>{#each rows as row}<tr data-comparison={row.id}><th scope="row">{row.label}{#if row.effect}<Help topic="hypEffect" />{/if}</th><td class="actual">{fmt(row.truth, row.effect)}</td><td>{fmt(row.current, row.effect)}</td>{#if averages}<td>{fmt(row.average, row.effect)}</td>{/if}<td>{fmt(row.truth !== null && row.current !== null ? row.current - row.truth : null, row.effect, true)}</td></tr>{/each}</tbody>
  </table>
</div>
<p>{averages ? t('hypothesis.comparisonNote') : t('hypothesis.previewComparisonNote')}</p>
<style>
  h3{font-size:17px;margin:24px 0 12px}p{font-size:12px;line-height:1.8;color:#697c6d}.comparison-scroll{overflow-x:auto}.comparison-scroll:focus-visible{outline:3px solid #b56832;outline-offset:3px}table{width:100%;border-collapse:collapse;font-size:12px;min-width:580px}th,td{padding:14px 12px;border-bottom:1px solid var(--line);text-align:right;line-height:1.7}thead th{font-size:11px;color:#697c6d;font-weight:500;max-width:170px}th:first-child{text-align:left;position:sticky;left:0;background:#fff;z-index:1}td{font-family:'DM Mono',monospace;white-space:nowrap}.actual{background:#edf4e6;color:#285c4a;font-weight:600}
</style>
