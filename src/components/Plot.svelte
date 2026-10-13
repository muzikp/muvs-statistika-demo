<script lang="ts">
  import { number } from '../lib/format';
  interface Point { x: number; y: number }
  let { points, title, xLabel, yLabel, reference, referenceLabel = 'Skute\u010dn\u00e1 hodnota', horizontal = false, kind = 'bar', color = '#287766', barOpacity = 1, secondaryPoints = [], secondaryColor = '#b56832', domain, barWidth, currentSample, totalSamples }: {
    points: Point[]; title: string; xLabel: string; yLabel: string; reference: number; referenceLabel?: string; horizontal?: boolean; kind?: 'bar' | 'line'; color?: string; barOpacity?: number; secondaryPoints?: Point[]; secondaryColor?: string; domain?: [number, number]; barWidth?: number; currentSample?: number; totalSamples?: number;
  } = $props();
  const left = 54, right = 590, top = 30, bottom = 228;
  let xMin = $derived(domain?.[0] ?? Math.min(0, ...points.map(p => p.x)));
  let xMax = $derived(domain?.[1] ?? Math.max(1, ...points.map(p => p.x)));
  let yMax = $derived(Math.max(1, ...points.map(p => p.y), ...secondaryPoints.map(p => p.y), horizontal ? reference * 1.15 : 0) * 1.08);
  let yTickValues = $derived(horizontal
    ? Array.from(new Set([0, yMax / 4, yMax / 2, yMax * 3 / 4, yMax, reference].filter(value => value >= 0 && value <= yMax))).sort((a, b) => a - b)
    : [0, yMax / 4, yMax / 2, yMax * 3 / 4, yMax]);
  const x = (value: number) => left + (value - xMin) / (xMax - xMin || 1) * (right-left);
  const y = (value: number) => bottom - value / yMax * (bottom-top);
  let width = $derived(Math.max(1, ((barWidth ?? (xMax-xMin)/Math.max(points.length, 1)) / (xMax-xMin || 1)) * (right-left) * .96));
  let line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' '));
  let secondaryLine = $derived(secondaryPoints.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' '));
</script>

<div class="plot-wrap">
  <svg viewBox="0 0 620 285" role="img" aria-label={`${title}. ${xLabel}, ${yLabel}. ${referenceLabel}: ${number(reference, 2)}.`}>
    <title>{title}</title>
    {#if currentSample !== undefined && totalSamples !== undefined}<text x={right} y="16" text-anchor="end" class="plot-progress">V&#253;b&#283;r {number(currentSample)} / {number(totalSamples)}</text>{/if}
    {#if kind !== 'bar'}
      {#each yTickValues as value}
        <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e3e8e3"><title>Pomocná vodorovná čára pro hodnotu {number(value, yMax < 10 ? 1 : 0)} na ose {yLabel}.</title></line>
        <text x={left-10} y={y(value)+4} text-anchor="end">{number(value, yMax < 10 ? 1 : 0)}<title>Hodnota {number(value, yMax < 10 ? 1 : 0)} na ose {yLabel}.</title></text>
      {/each}
    {/if}
    {#each [0, 1, 2, 3, 4] as tick}
      <text x={x(xMin + (xMax-xMin)*tick/4)} y={bottom+20} text-anchor="middle">{number(xMin + (xMax-xMin)*tick/4, xMax-xMin < 10 ? 1 : 0)}<title>Hodnota {number(xMin + (xMax-xMin)*tick/4, xMax-xMin < 10 ? 1 : 0)} na ose {xLabel}.</title></text>
    {/each}
    {#if kind === 'bar'}
      {#each points as p}
        <rect x={x(p.x)-width/2} y={y(p.y)} {width} height={bottom-y(p.y)} fill={color} opacity={barOpacity} rx="2"><title>{title}: hodnota {number(p.x, 2)}, počet výběrů {number(p.y, 0)}</title></rect>
      {/each}
    {:else}<path d={line} fill="none" stroke={color} stroke-width="2.5" />{/if}{#if kind === 'bar' && secondaryPoints.length}<path d={secondaryLine} fill="none" stroke={secondaryColor} stroke-width="2" stroke-dasharray="6 4" />{/if}
    {#if horizontal}
      <line x1={left} x2={right} y1={y(reference)} y2={y(reference)} stroke="#a94d38" stroke-width="1" stroke-dasharray="5 4" />
    {:else if reference >= xMin && reference <= xMax}
      <line x1={x(reference)} x2={x(reference)} y1={top} y2={bottom} stroke="#a94d38" stroke-width="1" stroke-dasharray="5 4" />
    {/if}
    {#if kind !== 'bar'}<text x={left} y="16" class="axis-label">{yLabel}<title>{yLabel}: co na svislé ose měříme.</title></text>{/if}<text x="322" y="278" text-anchor="middle" class="axis-label">{xLabel}<title>{xLabel}: jakou hodnotu na vodorovné ose sledujeme.</title></text>
  </svg>
  <div class="chart-legend"><span class="legend-dash"></span>{referenceLabel}: {number(reference, 2)}{horizontal ? ' %' : ''}</div>
</div>
