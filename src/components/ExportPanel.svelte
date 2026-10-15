<script lang="ts">
  import { t } from '../lib/texts';

  import { onMount } from 'svelte';
  import Help from './Help.svelte';
  import { number } from '../lib/format';
  import type { Population, SamplingConfig, SamplingIteration } from '../lib/sampling';
  import { exportSnapshot, type ExportKind, type ExportMessage, type ExportProgress } from '../lib/sampling-export';

  let { population, config, history, status, generating }: { population: Population; config: SamplingConfig | null; history: SamplingIteration[]; status: string; generating: boolean } = $props();
  let exporting = $state<ExportKind | null>(null), progress = $state<ExportProgress | null>(null), error = $state('');
  let downloadUrl = $state(''), downloadName = $state(''), exportedCount = $state(0);
  let worker: Worker | null = null;
  const ready = $derived(population.people.length > 0 && !generating);
  function start(kind: ExportKind) {
    if (!ready || exporting || (kind === 'results' && (!config || !history.length))) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = ''; downloadName = ''; error = ''; progress = null; exportedCount = history.length; exporting = kind;
    const snapshot = exportSnapshot(kind, population, config, history, status);
    try {
      const job = new Worker(new URL('../lib/export.worker.ts', import.meta.url), { type: 'module' }); worker = job;
      job.addEventListener('message', ({ data }: MessageEvent<ExportMessage>) => {
        if (job !== worker) return;
        if (data.type === 'progress') { progress = data; return; }
        if (data.type === 'error') error = data.message;
        else {
          downloadName = data.filename; downloadUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
          const link = document.createElement('a'); link.href = downloadUrl; link.download = downloadName; document.body.append(link); link.click(); link.remove();
        }
        exporting = null; job.terminate(); worker = null;
      });
      job.addEventListener('error', () => { if (job !== worker) return; error = t('export.exportSeNepodariloPripravitZkusteToZnovu'); exporting = null; job.terminate(); worker = null; });
      job.postMessage({ kind, snapshot });
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); exporting = null; worker?.terminate(); worker = null; }
  }
  onMount(() => () => { worker?.terminate(); if (downloadUrl) URL.revokeObjectURL(downloadUrl); });
</script>

<section class="export-panel" aria-labelledby="export-title">
  <p class="eyebrow">{t('export.dataProVlastniPraci')}</p><h2 id="export-title">{t('export.export')}</h2>
  <p class="export-intro">{t('export.stahneteSiDataDoExceluVeFormatuXlsx')}</p>
  <div class="export-options">
    <article><h3>{t('export.populace')}<Help topic="exportPopulation" /></h3><p>{t('export.vsechnyOsobyDemografieZnackaTelefonuATydenniCas')}</p><span>{ready ? t('export.populationpeoplelengthOsob', { populationPeopleLength: number(population.people.length) }) : t('export.nejprveVytvortePopulaci')}</span><button type="button" class="button secondary" data-export="population" disabled={!ready || exporting !== null} onclick={() => start('population')}>{t('export.stahnoutPopulaciXlsx')}</button></article>
    <article><h3>{t('export.vahy')}<Help topic="exportWeights" /></h3><p>{t('export.populacniPodilyVekPohlaviAProKazdyDokonceny')}</p><span>{history.length ? t('export.historylengthVyberu8Skupin', { historyLength: number(history.length) }) : t('export.populacniCileJsouDostupneIPredSimulaci')}</span><button type="button" class="button secondary" data-export="weights" disabled={!ready || exporting !== null} onclick={() => start('weights')}>{t('export.stahnoutVahyXlsx')}</button></article>
    <article><h3>{t('export.vysledkyVzorku')}<Help topic="exportIntervals" /></h3><p>{t('export.bodoveOdhadyDolniAHorniMezeCiA')}</p><span>{history.length ? t('export.historylengthDokoncenychVyberuObaUkazatele', { historyLength: number(history.length) }) : t('export.nejprveSpustteSimulaci')}</span><button type="button" class="button secondary" data-export="results" disabled={!ready || !config || !history.length || exporting !== null} onclick={() => start('results')}>{t('export.stahnoutVysledkyXlsx')}</button></article>
  </div>
  {#if exporting}<div class="export-progress" role="status" aria-live="polite"><strong>{progress?.stage === 'packaging' ? t('export.dokoncujiSouborXlsx') : t('export.pripravujiDataProExport')}</strong>{#if progress?.stage === 'rows' && progress.total > 0}<span>{number(progress.completed)} / {number(progress.total)} {t('export.radku')}</span><progress value={progress.completed} max={progress.total} aria-label={t('export.prubehPripravyExportu')}></progress>{:else}<progress aria-label={t('export.pripravaSouboruXlsx')}></progress>{/if}<p>{t('export.souborSePoDokonceniAutomatickyNabidneKeStazeni')}</p></div>{/if}
  {#if error}<p class="export-error" role="alert">{error}</p>{/if}
  {#if downloadUrl}<p class="export-ready" role="status">{t('export.soubor')} {downloadName} {t('export.jePripraven')} {downloadName !== 'populace.xlsx' ? t('export.zachycujeExportedcountDokoncenychVyberu', { exportedCount: number(exportedCount) }) : ''} <a href={downloadUrl} download={downloadName}>{t('export.stahnoutZnovu')}</a></p>{/if}
</section>

<style>
  .export-panel{margin-top:36px;padding-top:28px;border-top:1px solid var(--line)}.export-panel h2{font-size:28px;letter-spacing:-.03em;margin:0 0 12px}.export-intro{font-size:13px;line-height:1.8;color:#607f91;max-width:850px;margin-bottom:22px}.export-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.export-options article{display:flex;flex-direction:column;padding:24px;background:#fff;border:1px solid var(--line);min-width:0}.export-options h3{font-size:19px;margin:0 0 12px}.export-options p{font-size:13px;line-height:1.8;color:#607f91;margin:0 0 14px}.export-options span{font-size:11px;line-height:1.7;color:#778970;margin-top:auto;margin-bottom:14px}.export-options button{align-self:start}.export-options button:disabled{cursor:default}.export-options button:focus-visible{outline:3px solid #c34e4e;outline-offset:3px}.export-progress,.export-ready{padding:18px 22px;margin-top:16px;background:#e5f0f8;color:#47728a;font-size:13px;line-height:1.8}.export-progress strong,.export-progress span{display:block}.export-progress progress{display:block;width:100%;height:9px;accent-color:#397ec1;margin-top:10px}.export-progress p{font-size:12px;margin:10px 0 0}.export-ready a{font-weight:600;white-space:nowrap}.export-error{padding:14px 18px;background:#fff0eb;color:#c34e4e;border:1px solid #e9c5b9;font-size:13px;line-height:1.7}@media(max-width:800px){.export-options{grid-template-columns:1fr}.export-options article{padding:20px}}
</style>
