<script lang="ts">
  import { onMount } from 'svelte';
  import { number, percent } from '../lib/format';
  import type { BatchSummary } from '../lib/types';

  let batches = $state<BatchSummary[]>([]);
  let category = $state(0);
  let showForest = $state(true);
  let truth = $state(0.5);
  let isMean = $state(false);

  onMount(() => {
    const receive = (event: Event) => {
      if (!showForest) return;
      const detail = (event as CustomEvent).detail;
      if (detail?.batches) batches = detail.batches; else if (detail?.batch) batches = [...batches.filter(b => b.index !== detail.batch.index), detail.batch].sort((a, b) => a.index - b.index);
    };
    const forestToggle = (event: Event) => { showForest = (event as CustomEvent).detail?.show !== false; if (!showForest) batches = []; };
    try { const saved = JSON.parse(localStorage.getItem('muvs-statistika-config') || '{}'); showForest = saved.showForest !== false; } catch {}
    const categoryChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      category = Number(detail?.index ?? 0);
      isMean = detail?.mode === 'mean';
      if (Number.isFinite(detail?.truth)) truth = detail.truth;
    };
    const reset = () => { batches = []; };
    window.addEventListener('muvs-simulation-reset', reset);
    window.addEventListener('muvs-simulation-update', receive);
    window.addEventListener('muvs-forest-toggle', forestToggle);
    window.addEventListener('muvs-category-change', categoryChange);
    return () => {
      window.removeEventListener('muvs-simulation-reset', reset);
      window.removeEventListener('muvs-simulation-update', receive);
      window.removeEventListener('muvs-forest-toggle', forestToggle);
      window.removeEventListener('muvs-category-change', categoryChange);
    };
  });

  const averageInterval = $derived.by(() => {
    const intervals = batches.flatMap(batch => batch.categories[category]?.intervals ?? []);
    if (!intervals.length) return null;
    return {
      low: intervals.reduce((sum, interval) => sum + interval.low, 0) / intervals.length,
      high: intervals.reduce((sum, interval) => sum + interval.high, 0) / intervals.length,
      estimate: intervals.reduce((sum, interval) => sum + interval.estimate, 0) / intervals.length
    };
  });
  const domain = $derived.by(() => {
    if (!isMean || !averageInterval) return [0, 1];
    const low = Math.min(truth, averageInterval.low);
    const high = Math.max(truth, averageInterval.high);
    const padding = Math.max((high - low) * 0.2, Math.abs(truth) * 0.01, 0.01);
    return [low - padding, high + padding];
  });
  const position = (value: number) => (value - domain[0]) / (domain[1] - domain[0]) * 100;
  const formatValue = (value: number) => isMean ? number(value, 2) : percent(value);
</script>

{#if showForest && averageInterval}
<section class="forest-panel chart-card wide">
  <div class="forest-head">
    <div>
      <div class="card-kicker">PR&#366;B&#282;&#381;N&#221; SOUHRN</div>
      <h3>Pr&#367;m&#283;rn&#253; interval</h3>
      <p>Jedna &#250;se&#269;ka shrnuje pr&#367;m&#283;r doln&#237;ch a horn&#237;ch mez&#237; v&#353;ech dosud vytvo&#345;en&#253;ch interval&#367;. Aktualizuje se po ka&#382;d&#233;m v&#253;b&#283;ru.</p>
    </div>
  </div>
  <div class="forest-rows">
    <div class="forest-truth" style={`left:${position(truth)}%`}></div>
    {#if averageInterval}
      <div class="forest-row forest-average" title="Pr&#367;m&#283;r doln&#237;ch a horn&#237;ch mez&#237; v&#353;ech dosud vytvo&#345;en&#253;ch interval&#367;">
        <span>&Oslash;</span>
        <div class="forest-range" style={`left:${position(averageInterval.low)}%;width:${position(averageInterval.high) - position(averageInterval.low)}%`}>
          <i style={`left:${Math.max(0, Math.min(100, (averageInterval.estimate - averageInterval.low) / (averageInterval.high - averageInterval.low || 1) * 100))}%`}></i>
          <span class="forest-value forest-value-low">{formatValue(averageInterval.low)}</span>
          <span class="forest-value forest-value-estimate" style={`left:${Math.max(0, Math.min(100, (averageInterval.estimate - averageInterval.low) / (averageInterval.high - averageInterval.low || 1) * 100))}%`}>{formatValue(averageInterval.estimate)}</span>
          <span class="forest-value forest-value-high">{formatValue(averageInterval.high)}</span>
        </div>
      </div>
    {/if}
  </div>
  <div class="forest-caption"><span>{formatValue(domain[0])}</span><strong>Skute&#269;n&#225; hodnota: {formatValue(truth)}</strong><span>{formatValue(domain[1])}</span></div>
</section>
{/if}
