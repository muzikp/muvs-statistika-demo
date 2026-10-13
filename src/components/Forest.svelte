<script lang="ts">
  import type { Interval } from '../lib/types';
  import { percent } from '../lib/format';
  let { intervals, truth, color = '#287766' }: { intervals: Interval[]; truth: number; color?: string } = $props();
  let low = $derived(Math.max(0, Math.min(truth, ...intervals.map(i => i.low)) - .02));
  let high = $derived(Math.min(1, Math.max(truth, ...intervals.map(i => i.high)) + .02));
  const x = (p: number) => 65 + (p-low)/(high-low || 1)*475;
  let height = $derived(intervals.length*22 + 50);
</script>
<svg class="forest" viewBox={`0 0 590 ${height}`} role="img" aria-label={`Prvních ${intervals.length} intervalů. Svislá čára značí skutečný podíl ${percent(truth)}; křížek značí interval mimo.`}>
  <title>Intervalový les</title>
  <line x1={x(truth)} x2={x(truth)} y1="10" y2={height-30} stroke="#a94d38" stroke-dasharray="4 4" />
  {#each intervals as ci, i}
    {@const y = 22 + i*22}
    <text x="8" y={y+4}>#{i+1}</text>
    <g stroke={ci.outside ? '#b74335' : color} fill={ci.outside ? '#b74335' : color}>
      <title>Vzorek {i+1}: {percent(ci.low, 2)} až {percent(ci.high, 2)}; {ci.outside ? 'mimo' : 'obsahuje skutečný podíl'}</title>
      <line x1={x(ci.low)} x2={x(ci.high)} y1={y} y2={y} stroke-width="2" />
      <line x1={x(ci.low)} x2={x(ci.low)} y1={y-4} y2={y+4} /><line x1={x(ci.high)} x2={x(ci.high)} y1={y-4} y2={y+4} />
      {#if ci.outside}<path d={`M${x(ci.estimate)-4},${y-4}l8,8m0,-8l-8,8`} fill="none" stroke-width="2" />{:else}<circle cx={x(ci.estimate)} cy={y} r="3" />{/if}
    </g>
  {/each}
  <text x="65" y={height-8}>{percent(low)}</text><text x={x(truth)} y={height-8} text-anchor="middle">p = {percent(truth)}</text><text x="540" y={height-8} text-anchor="end">{percent(high)}</text>
</svg>
