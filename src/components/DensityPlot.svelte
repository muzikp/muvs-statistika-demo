<script lang="ts">
  import { number } from '../lib/format';
  import { t } from '../lib/texts';
  import type { DensityPoint } from '../lib/hypothesis';
  interface Series { points: DensityPoint[]; label: string; color: string; dashed?: boolean }
  interface Region { from: number; to: number; color: string; label: string; opacity?: number }
  interface Marker { value: number; label: string; color: string; dashed?: boolean; width?: number }
  let { series, domain, title, xLabel, regions = [], markers = [], showMarkerLegend = false }: { series: Series[]; domain: [number, number]; title: string; xLabel: string; regions?: Region[]; markers?: Marker[]; showMarkerLegend?: boolean } = $props();
  let expanded = $state(false);
  const left = 55, right = 675, top = 20, bottom = 230;
  const maximum = $derived(Math.max(1e-9, ...series.flatMap(line => line.points.map(point => point.y))) * 1.12);
  const x = (value: number) => left + (Math.max(domain[0], Math.min(domain[1], value)) - domain[0]) / (domain[1] - domain[0]) * (right - left);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const path = (points: DensityPoint[]) => points.map((point, i) => `${i ? 'L' : 'M'}${x(point.x)},${y(point.y)}`).join(' ');
  function area(region: Region) {
    const points = series[0]?.points.filter(point => point.x >= Math.max(region.from, domain[0]) && point.x <= Math.min(region.to, domain[1])) ?? [];
    return points.length ? `M${x(points[0].x)},${bottom} ${path(points).replace(/^M/, 'L')} L${x(points[points.length - 1].x)},${bottom} Z` : '';
  }
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') expanded = false; }} />
<div class:plot-expanded={expanded} class="density-plot" role="button" tabindex="0" onclick={(event) => { if (expanded && event.target === event.currentTarget) expanded = false; else if (!expanded) expanded = true; }} onkeydown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) expanded = true; }}>
  <button class="plot-expand" type="button" aria-label={expanded ? t('plot.zavritGraf') : t('plot.zvetsitGraf')} onclick={(event) => { event.stopPropagation(); expanded = !expanded; }}>{expanded ? 'x' : '+'}</button>
  <svg viewBox="0 0 700 285" role="img" aria-label={`${title}. ${xLabel}. ${markers.map(marker => marker.label).join('; ')}`}>
    <title>{title}</title>
    {#each [0, .25, .5, .75, 1] as tick}
      <line x1={left} x2={right} y1={y(tick * maximum)} y2={y(tick * maximum)} stroke="#e3e8e3" />
      <text x={left - 8} y={y(tick * maximum) + 4} text-anchor="end">{number(tick * maximum, maximum < .1 ? 3 : 2)}</text>
      <text x={x(domain[0] + tick * (domain[1] - domain[0]))} y={bottom + 20} text-anchor="middle">{number(domain[0] + tick * (domain[1] - domain[0]), 1)}</text>
    {/each}
    {#each regions as region}<path d={area(region)} fill={region.color} opacity={region.opacity ?? .25}><title>{region.label}</title></path>{/each}
    {#each series as line}<path d={path(line.points)} fill="none" stroke={line.color} stroke-width="2.4" stroke-dasharray={line.dashed ? '6 4' : undefined}><title>{line.label}</title></path>{/each}
    {#each markers as marker}
      <line x1={x(marker.value)} x2={x(marker.value)} y1={top} y2={bottom} stroke={marker.color} stroke-width={marker.width ?? (marker.dashed ? 1.5 : 2)} stroke-dasharray={marker.dashed ? '5 5' : undefined}><title>{marker.label}</title></line>
      {#if marker.value < domain[0] || marker.value > domain[1]}<text x={x(marker.value)} y={top + 10} text-anchor="middle" style:fill={marker.color}>{marker.value < domain[0] ? '←' : '→'}</text>{/if}
    {/each}
    <text x={left} y="12">{t('hypothesis.density')}</text><text x="365" y="275" text-anchor="middle">{xLabel}</text>
  </svg>
  <div class="density-legend">{#each series as line}<span><i class:dashed={line.dashed} style:color={line.color}></i>{line.label}</span>{/each}{#each Array.from(new Map(regions.map(region => [region.label, region])).values()) as region}<span><i style:color={region.color}></i>{region.label}</span>{/each}{#if showMarkerLegend}{#each markers as marker}<span><i class:dashed={marker.dashed} style:color={marker.color}></i>{marker.label}</span>{/each}{/if}</div>
</div>

<style>
  .density-plot{position:relative}.density-plot svg{display:block;width:100%;height:auto;cursor:zoom-in}text{font:10px 'DM Mono',monospace;fill:#718175}.density-legend{display:flex;flex-wrap:wrap;gap:10px 20px;font-size:11px;color:#64766a;margin-top:8px}.density-legend span{display:flex;align-items:center;gap:7px}.density-legend i{width:16px;height:0;display:inline-block;border-top:3px solid currentColor;flex-shrink:0}.density-legend i.dashed{border-top-style:dashed}.plot-expand{position:absolute;right:8px;top:8px;z-index:2;border:1px solid #cbdce8;border-radius:4px;background:rgba(255,255,255,.9);color:#2f6f8f;width:30px;height:30px;cursor:pointer;font-size:17px;line-height:1}.plot-expanded{position:fixed;inset:0;z-index:1000;background:rgba(18,45,60,.82);display:flex;flex-direction:column;justify-content:center;padding:clamp(16px,4vw,64px);box-sizing:border-box}.plot-expanded .plot-expand{right:clamp(16px,4vw,64px);top:clamp(16px,4vw,64px);width:38px;height:38px;background:white;font-size:24px}.plot-expanded svg{width:min(1200px,100%);max-height:calc(100vh - 130px);margin:0 auto;cursor:default;background:white;border-radius:4px}.plot-expanded .density-legend{width:min(1200px,100%);margin:10px auto 0;color:white}.plot-expanded .density-legend i{border-color:white}@media(max-width:700px){.plot-expanded{padding:14px}.plot-expanded .plot-expand{right:14px;top:14px}}
</style>
