<script lang="ts">
  import { t } from '../lib/texts';

  import { number } from '../lib/format';
  interface Point { x: number; y: number }
  let { points, title, xLabel, yLabel, reference, referenceLabel = t('plot.skutecnaHodnota'), horizontal = false, kind = 'bar', color = '#397ec1', barOpacity = 1, secondaryPoints = [], secondaryColor = '#c34e4e', domain, barWidth, currentSample, totalSamples, finalValue, finalLabel }: {
    points: Point[]; title: string; xLabel: string; yLabel: string; reference: number; referenceLabel?: string; horizontal?: boolean; kind?: 'bar' | 'line'; color?: string; barOpacity?: number; secondaryPoints?: Point[]; secondaryColor?: string; domain?: [number, number]; barWidth?: number; currentSample?: number; totalSamples?: number; finalValue?: number; finalLabel?: string;
  } = $props();
  let expanded = $state(false);
  const left = 54, right = 590, top = 30, bottom = 228;
  let xMin = $derived(domain?.[0] ?? Math.min(0, ...points.map(p => p.x)));
  let xMax = $derived(domain?.[1] ?? Math.max(1, ...points.map(p => p.x)));
  let yMax = $derived(Math.max(1, ...points.map(p => p.y), ...secondaryPoints.map(p => p.y), horizontal ? reference * 1.15 : 0) * 1.08);
  let yTickValues = $derived(horizontal
    ? Array.from(new Set([0, reference, yMax].filter(value => value >= 0 && value <= yMax))).sort((a, b) => a - b)
    : kind === 'bar' ? Array.from(new Set([0, yMax / 4, yMax / 2, yMax * 3 / 4, yMax].map(Math.floor))) : [0, yMax / 4, yMax / 2, yMax * 3 / 4, yMax]);
  const x = (value: number) => left + (value - xMin) / (xMax - xMin || 1) * (right-left);
  const y = (value: number) => bottom - value / yMax * (bottom-top);
  let width = $derived(Math.max(1, ((barWidth ?? (xMax-xMin)/Math.max(points.length, 1)) / (xMax-xMin || 1)) * (right-left) * .96));
  let line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' '));
  let secondaryLine = $derived(secondaryPoints.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)},${y(p.y)}`).join(' '));
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') expanded = false; }} />
<div class:plot-expanded={expanded} class="plot-wrap" role="button" tabindex="0" onclick={(event) => { if (expanded && event.target === event.currentTarget) expanded = false; else if (!expanded) expanded = true; }} onkeydown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) expanded = true; }}>
  <button class="plot-expand" type="button" aria-label={expanded ? t('plot.zavritGraf') : t('plot.zvetsitGraf')} onclick={(event) => { event.stopPropagation(); expanded = !expanded; }}>{expanded ? 'x' : '+'}</button>
  <svg viewBox="0 0 620 285" role="img" aria-label={`${title}. ${xLabel}, ${yLabel}. ${referenceLabel}: ${number(reference, 2)}.`}>
    <title>{title}</title>
    {#if currentSample !== undefined && totalSamples !== undefined}<text x={right} y="16" text-anchor="end" class="plot-progress">{t('plot.vyber')} {number(currentSample)} / {number(totalSamples)}</text>{/if}
      {#each yTickValues as value}
        {#if !horizontal}<line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e3e8e3"><title>{t('plot.pomocnaVodorovnaCaraProHodnotu')} {number(value, yMax < 10 ? 1 : 0)} {t('plot.naOse')} {yLabel}.</title></line>{/if}
        <text x={left-10} y={y(value)+4} text-anchor="end">{number(value, kind !== 'bar' && yMax < 10 ? 1 : 0)}<title>{t('plot.hodnota')} {number(value, kind !== 'bar' && yMax < 10 ? 1 : 0)} {t('plot.naOse')} {yLabel}.</title></text>
      {/each}
    {#each [0, 1, 2, 3, 4] as tick}
      <text x={x(xMin + (xMax-xMin)*tick/4)} y={bottom+20} text-anchor="middle">{number(xMin + (xMax-xMin)*tick/4, xMax-xMin < 10 ? 1 : 0)}<title>{t('plot.hodnota')} {number(xMin + (xMax-xMin)*tick/4, xMax-xMin < 10 ? 1 : 0)} {t('plot.naOse')} {xLabel}.</title></text>
    {/each}
    {#if kind === 'bar'}
      {#each points as p}
        <rect x={x(p.x)-width/2} y={y(p.y)} {width} height={bottom-y(p.y)} fill={color} opacity={barOpacity} rx="2"><title>{title}{t('plot.hodnota2')} {number(p.x, 2)}{t('plot.pocetVyberu')} {number(p.y, 0)}</title></rect>
      {/each}
    {:else}<path d={line} fill="none" stroke={color} stroke-width="2.5" />{/if}{#if kind === 'bar' && secondaryPoints.length}<path d={secondaryLine} fill="none" stroke={secondaryColor} stroke-width="2" stroke-dasharray="6 4" />{/if}
    {#if horizontal}
      <line x1={left} x2={right} y1={y(reference)} y2={y(reference)} stroke="#c34e4e" stroke-width="1" stroke-dasharray="5 4" />
    {:else if reference >= xMin && reference <= xMax}
      <line x1={x(reference)} x2={x(reference)} y1={top} y2={bottom} stroke="#c34e4e" stroke-width="1" stroke-dasharray="5 4" />
    {/if}
    <text x={left} y="16" class="axis-label">{yLabel}<title>{yLabel}{t('plot.coNaSvisleOseMerime')}</title></text><text x="322" y="278" text-anchor="middle" class="axis-label">{xLabel}<title>{xLabel}{t('plot.jakouHodnotuNaVodorovneOseSledujeme')}</title></text>
  </svg>
  <div class="chart-legend"><span><span class="legend-dash"></span>{referenceLabel}: {number(reference, 2)}{horizontal ? ' %' : ''}</span>{#if finalValue !== undefined && finalLabel}<span class="final-value">{finalLabel}: {number(finalValue, 2)} %</span>{/if}</div>
</div>

<style>
  .plot-wrap{position:relative}.plot-wrap svg{display:block;width:100%;height:auto;cursor:zoom-in}.plot-expand{position:absolute;right:8px;top:8px;z-index:2;border:1px solid #cbdce8;border-radius:4px;background:rgba(255,255,255,.9);color:#397ec1;width:30px;height:30px;cursor:pointer;font-size:17px;line-height:1}.plot-expanded{position:fixed;inset:0;z-index:1000;background:rgba(18,45,60,.82);display:flex;flex-direction:column;justify-content:center;padding:clamp(16px,4vw,64px);box-sizing:border-box}.plot-expanded .plot-expand{right:clamp(16px,4vw,64px);top:clamp(16px,4vw,64px);width:38px;height:38px;background:white;font-size:24px}.plot-expanded svg{width:min(1200px,100%);max-height:calc(100vh - 130px);margin:0 auto;cursor:default;background:white;border-radius:4px}.chart-legend{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.final-value{font-weight:600;color:#397ec1}.plot-expanded .chart-legend{width:min(1200px,100%);margin:10px auto 0;color:white}.plot-expanded .legend-dash{background:white}@media(max-width:700px){.plot-expanded{padding:14px}.plot-expanded .plot-expand{right:14px;top:14px}}
</style>
