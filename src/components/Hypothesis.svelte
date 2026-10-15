<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { t } from '../lib/texts';
  import { number, percent } from '../lib/format';
  import { MAX_POPULATION, MAX_REPEATS } from '../lib/sampling';
  import { DEFAULT_HYPOTHESIS_SPEC, hypothesisConvergence, hypothesisNullTrue, populationDifference, validateHypothesis, validateHypothesisPopulation, type Alternative, type HypothesisConfig, type HypothesisIteration, type HypothesisMessage, type HypothesisPopulationSummary } from '../lib/hypothesis';
  import { studentDensity } from '../lib/student';
  import { hypothesisMeanCurves } from '../lib/hypothesis-plots';
  // Keep worker code with the loaded page so later deployments cannot remove it.
  import HypothesisWorker from '../lib/hypothesis.worker.ts?worker&inline';
  import Help from './Help.svelte';
  import Plot from './Plot.svelte';
  import DensityPlot from './DensityPlot.svelte';
  import HypothesisForest from './HypothesisForest.svelte';
  import HypothesisComparison from './HypothesisComparison.svelte';

  let spec = $state({ ...DEFAULT_HYPOTHESIS_SPEC });
  let activeSpec = $state<typeof DEFAULT_HYPOTHESIS_SPEC | null>(null);
  let readyPopulation = $state.raw<HypothesisPopulationSummary | null>(null);
  const populationDirty = $derived(activeSpec !== null && JSON.stringify(spec) !== JSON.stringify(activeSpec));
  let nA = $state(100), nB = $state(100), repeats = $state(200), alpha = $state(5), nullDifference = $state(0), seed = $state('testy-2026');
  let alternative = $state<Alternative>('two-sided');
  let draw = $state(0), speed = $state(4), showForest = $state(true);
  let preview = $state.raw<{ config: HypothesisConfig; population: HypothesisPopulationSummary; entry: HypothesisIteration } | null>(null);
  let previewPending = $state(false), previewError = $state(''), generated = $state(0), generating = $state(false);
  let previewWorker: Worker | null = null, previewRequest = 0, previewTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlightPreview: number | null = null;
  let queuedPreview: { config: HypothesisConfig; draw: number; requestId: number; due: number } | null = null;
  let status = $state<'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'>('idle');
  let history = $state.raw<HypothesisIteration[]>([]), run = $state.raw<HypothesisConfig | null>(null), runPopulation = $state.raw<HypothesisPopulationSummary | null>(null);
  let simulationWorker: Worker | null = null, runGenerated = $state(0), runGenerating = $state(false), error = $state('');
  let exportWorker: Worker | null = null, exporting = $state(false), exportProgress = $state(0), exportTotal = $state(0), exportUrl = $state(''), exportedLabel = $state('');
  const busy = $derived(status === 'running' || status === 'paused');
  const nullSliderLimit = $derived(Math.min(1000, Math.max(50, Math.ceil(Math.abs(nullDifference || 0) / 50) * 50)));
  const currentConfig = $derived(preview?.config ?? null);
  const population = $derived(preview?.population ?? readyPopulation);
  const last = $derived(preview?.entry.result ?? null);
  const convergence = $derived(run ? hypothesisConvergence(history, run) : null);
  const nullTrue = $derived(run ? hypothesisNullTrue(populationDifference(run.population), run) : false);
  const runDiffers = $derived(run && currentConfig ? JSON.stringify({ ...run, repeats: 1 }) !== JSON.stringify(currentConfig) : false);
  const meanCurves = $derived(last && population ? hypothesisMeanCurves(last, population) : null);
  const groupColors = ['#397ec1', '#c34e4e'];
  const meanSeries = $derived(meanCurves ? meanCurves.groups.map((group, g) => ({ points: group.points, label: t('hypothesis.meanGraphSeries', { group: g ? t('hypothesis.groupB') : t('hypothesis.groupA'), se: number(group.se, 2) }), color: groupColors[g], dashed: true })) : []);
  const meanMarkers = $derived(meanCurves && population ? meanCurves.groups.flatMap((group, g) => [
    { value: population.groups[g].mean, label: t('hypothesis.meanGraphPopulation', { group: g ? 'B' : 'A', mean: number(population.groups[g].mean, 2) }), color: groupColors[g], dashed: false, width: g ? 2 : 4 },
    { value: group.mean, label: t('hypothesis.meanGraphEstimate', { group: g ? 'B' : 'A', mean: number(group.mean, 2) }), color: groupColors[g], dashed: true, width: 2 }
  ]) : []);
  const testDomain = $derived<[number, number]>([-Math.max(5, Math.min(12, Math.abs(last?.statistic ?? 0) + 1), (last?.critical ?? 2) + 1), Math.max(5, Math.min(12, Math.abs(last?.statistic ?? 0) + 1), (last?.critical ?? 2) + 1)]);
  const testSeries = $derived(last ? [{ points: Array.from({ length: 801 }, (_, i) => { const x = testDomain[0] + i / 800 * (testDomain[1] - testDomain[0]); return { x, y: studentDensity(x, last.df) }; }), label: t('hypothesis.nullCurve'), color: '#6676b4' }] : []);
  const regions = $derived.by(() => {
    if (!last || !currentConfig) return [];
    const critical = { color: last.reject ? '#c34e4e' : '#b56832', opacity: last.reject ? .3 : .25, label: t('hypothesis.criticalArea') }, p = { color: last.reject ? '#c34e4e' : '#397ec1', opacity: last.reject ? .3 : .25, label: t('hypothesis.pArea') };
    return currentConfig.alternative === 'two-sided' ? [{ ...critical, from: -Infinity, to: -last.critical }, { ...critical, from: last.critical, to: Infinity }, { ...p, from: -Infinity, to: -Math.abs(last.statistic) }, { ...p, from: Math.abs(last.statistic), to: Infinity }] : currentConfig.alternative === 'greater' ? [{ ...critical, from: last.critical, to: Infinity }, { ...p, from: last.statistic, to: Infinity }] : [{ ...critical, from: -Infinity, to: -last.critical }, { ...p, from: -Infinity, to: last.statistic }];
  });
  const bound = (value: number) => Number.isFinite(value) ? number(value, 2) : value < 0 ? '−∞' : '+∞';
  const pText = (value: number) => value < .000001 ? t('hypothesis.pSmall') : number(value, 6);
  const snapshot = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

  function connectPreview() {
    const job = new HypothesisWorker(); previewWorker = job;
    job.onmessage = ({ data }: MessageEvent<HypothesisMessage>) => {
      if (job !== previewWorker || data.requestId !== inFlightPreview) return;
      const latest = data.requestId === previewRequest;
      if (data.type === 'population-progress' && latest) { generated = data.completed; generating = true; }
      else if (data.type === 'population-ready' && latest) {
        inFlightPreview = null; generating = false; readyPopulation = data.population;
        activeSpec = snapshot(data.population.spec);
      }
      else if (data.type === 'preview-ready') {
        inFlightPreview = null;
        // During a drag, show finished intermediate sizes instead of waiting
        // for the pointer to stop. Other changed settings keep strict versioning.
        const sameExperiment = queuedPreview && JSON.stringify({ ...data.config, nA: 0, nB: 0 }) === JSON.stringify({ ...queuedPreview.config, nA: 0, nB: 0 });
        if (latest || sameExperiment) { preview = { config: data.config, population: data.population, entry: data.entry }; generating = false; previewError = ''; }
        if (latest) previewPending = false;
        flushPreview();
      } else if (data.type === 'error') {
        inFlightPreview = null;
        if (latest) { previewError = data.message; preview = null; previewPending = false; generating = false; }
        flushPreview();
      }
    };
    job.onerror = () => { if (job !== previewWorker) return; previewError = t('hypothesis.workerError'); previewPending = false; generating = false; preview = null; inFlightPreview = null; queuedPreview = null; job.terminate(); previewWorker = null; };
    return job;
  }
  function flushPreview() {
    if (inFlightPreview !== null || !queuedPreview) return;
    clearTimeout(previewTimer);
    const wait = queuedPreview.due - performance.now();
    if (wait > 0) { previewTimer = setTimeout(flushPreview, wait); return; }
    const request = queuedPreview; queuedPreview = null; inFlightPreview = request.requestId;
    (previewWorker ?? connectPreview()).postMessage({ type: 'preview', config: snapshot(request.config), draw: request.draw, requestId: request.requestId });
  }
  function schedulePreview(config: HypothesisConfig, selectedDraw: number) {
    clearTimeout(previewTimer); const requestId = ++previewRequest;
    const errors = validateHypothesis(config);
    generated = 0; generating = false;
    if (errors.length) { queuedPreview = null; previewError = errors[0]; previewPending = false; preview = null; return; }
    previewError = ''; previewPending = true;
    const populationChanged = !preview || JSON.stringify(config.population) !== JSON.stringify(preview.population.spec);
    queuedPreview = { config, draw: selectedDraw, requestId, due: performance.now() + (populationChanged ? 180 : 0) };
    flushPreview();
  }
  $effect(() => {
    if (!activeSpec) return;
    const config: HypothesisConfig = { population: snapshot(activeSpec), nA, nB, repeats: 1, seed, alpha: alpha / 100, nullDifference, alternative };
    const selectedDraw = draw;
    untrack(() => schedulePreview(config, selectedDraw));
  });
  function generatePopulation() {
    if (generating || busy) return;
    const errors = validateHypothesisPopulation(spec);
    if (errors.length) { previewError = errors[0]; return; }
    clearTimeout(previewTimer); previewWorker?.terminate(); previewWorker = null;
    queuedPreview = null; inFlightPreview = ++previewRequest;
    preview = null; readyPopulation = null; activeSpec = null; previewError = ''; generated = 0; generating = true;
    (previewWorker ?? connectPreview()).postMessage({ type: 'generate', spec: snapshot(spec), requestId: previewRequest });
  }
  function start() {
    if (busy || previewPending || !preview) return;
    const config = { ...preview.config, repeats }, errors = validateHypothesis(config);
    if (errors.length) { error = errors[0]; return; }
    simulationWorker?.terminate(); run = snapshot(config); runPopulation = preview.population; history = []; error = ''; runGenerated = 0; runGenerating = true; status = 'running';
    const job = new HypothesisWorker(); simulationWorker = job;
    job.onmessage = ({ data }: MessageEvent<HypothesisMessage>) => {
      if (job !== simulationWorker) return;
      if (data.type === 'population-progress') { runGenerated = data.completed; return; }
      if (data.type === 'population-ready') { runPopulation = data.population; runGenerating = false; return; }
      if (data.type === 'error') { error = data.message; status = 'error'; runGenerating = false; job.terminate(); simulationWorker = null; return; }
      if (data.type !== 'progress' && data.type !== 'completed') return;
      history = [...history, ...data.entries];
      if (data.type === 'completed') { status = 'completed'; job.terminate(); simulationWorker = null; }
    };
    job.onerror = () => { if (job !== simulationWorker) return; error = t('hypothesis.workerError'); status = 'error'; runGenerating = false; job.terminate(); simulationWorker = null; };
    job.postMessage({ type: 'simulate', config: snapshot(config), speed });
  }
  function pause() { simulationWorker?.postMessage({ type: status === 'paused' ? 'resume' : 'pause' }); status = status === 'paused' ? 'running' : 'paused'; }
  function stop() { simulationWorker?.terminate(); simulationWorker = null; status = 'stopped'; runGenerating = false; }
  function changeSpeed(value: number) { speed = value; simulationWorker?.postMessage({ type: 'speed', speed }); }
  function download(single: boolean) {
    const sourcePopulation = single ? preview?.population : runPopulation, config = single ? preview?.config : run;
    const entries = single && preview ? [preview.entry] : history;
    if (!sourcePopulation || !config || !entries.length || exporting) return;
    if (exportUrl) URL.revokeObjectURL(exportUrl); exportUrl = ''; exporting = true; exportProgress = 0; exportTotal = entries.length; error = ''; exportedLabel = single ? t('hypothesis.previewSample') : t('hypothesis.simulationExportLabel');
    const job = new Worker(new URL('../lib/hypothesis-export.worker.ts', import.meta.url), { type: 'module' }); exportWorker = job;
    job.onmessage = ({ data }) => {
      if (data.type === 'progress') { exportProgress = data.completed; return; }
      if (data.type === 'ready') { exportUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const link = document.createElement('a'); link.href = exportUrl; link.download = 'testovani-hypotez.xlsx'; document.body.append(link); link.click(); link.remove(); }
      else error = data.message;
      exporting = false; job.terminate(); exportWorker = null;
    };
    job.onerror = () => { error = t('export.exportSeNepodariloPripravitZkusteToZnovu'); exporting = false; job.terminate(); exportWorker = null; };
    job.postMessage({ population: sourcePopulation, config, history: entries });
  }
  onMount(() => () => { clearTimeout(previewTimer); queuedPreview = null; previewWorker?.terminate(); simulationWorker?.terminate(); exportWorker?.terminate(); if (exportUrl) URL.revokeObjectURL(exportUrl); });
</script>

<section class="hypothesis-lab" aria-label={t('hypothesis.title')}>
  <div class="setup-grid">
    <section class="hyp-card">
      <p class="card-kicker">{t('hypothesis.populationStep')}<Help topic="hypPopulation" /></p><h2>{t('hypothesis.populationTitle')}</h2><p class="note">{t('hypothesis.populationNote')}</p>
      <div class="fields"><label>{t('hypothesis.size')}<Help topic="hypPopulation" /><input data-field="size" disabled={generating || busy} type="number" min="10000" max={MAX_POPULATION} step="10000" bind:value={spec.size} /></label><label>{t('simulator.seedPopulace')}<Help topic="hypPopulation" /><input data-field="populationSeed" disabled={generating || busy} bind:value={spec.seed} /></label>
        <label>{t('hypothesis.meanA')}<Help topic="hypDifference" /><input data-field="meanA" disabled={generating || busy} type="number" min="1" max="1000" step="1" bind:value={spec.meanA} /></label><label>{t('hypothesis.meanB')}<Help topic="hypDifference" /><input data-field="meanB" disabled={generating || busy} type="number" min="1" max="1000" step="1" bind:value={spec.meanB} /></label>
        <label>{t('hypothesis.spreadA')}<Help topic="hypPopulation" /><input data-field="spreadA" disabled={generating || busy} type="number" min="1" max="100" step="1" bind:value={spec.spreadA} /></label><label>{t('hypothesis.spreadB')}<Help topic="hypPopulation" /><input data-field="spreadB" disabled={generating || busy} type="number" min="1" max="100" step="1" bind:value={spec.spreadB} /></label></div>
      <p class="note">{t('hypothesis.manualPopulationNote')}</p>
      <button data-action="generate-population" class="button primary" disabled={generating || busy} onclick={generatePopulation}>{t('simulator.vytvoritPopulaci')}</button>
      {#if populationDirty}<p class="warning" role="status">{t('hypothesis.populationDirty')}</p>{/if}
      {#if !activeSpec && !generating}<p class="note" role="status">{t('hypothesis.populationNeeded')}</p>{/if}
      {#if population && !generating}<p class="note" role="status">{t('hypothesis.populationReady')}</p>{/if}
      {#if generating}<div role="status" class="generation"><strong>{t('hypothesis.generating')}</strong><progress value={generated} max={(activeSpec?.size ?? spec.size) * 2} aria-label={t('simulator.prubehVytvareniPopulace')}></progress><span>{t('hypothesis.generated', { completed: number(generated), total: number((activeSpec?.size ?? spec.size) * 2) })}</span></div>{/if}
    </section>
    <section class="hyp-card">
      <p class="card-kicker">{t('hypothesis.sampleStep')}<Help topic="hypSample" /></p><h2>{t('hypothesis.sampleTitle')}</h2>
      <div class="fields"><label>{t('hypothesis.nA')}<Help topic="hypSample" /><input data-field="nA" type="number" min="20" max="2000" step="1" bind:value={nA} /></label><label>{t('hypothesis.nB')}<Help topic="hypSample" /><input data-field="nB" type="number" min="20" max="2000" step="1" bind:value={nB} /></label>
        <label>{t('hypothesis.alpha')}<Help topic="hypAlpha" /><input data-field="alpha" type="number" min=".1" max="20" step=".1" bind:value={alpha} /></label><label>{t('hypothesis.nullDifference')}<Help topic="hypDifference" /><input data-field="nullDifference" type="number" min="-1000" max="1000" step=".5" bind:value={nullDifference} /></label></div>
      <label>{t('hypothesis.alternative')}<Help topic="hypAlternative" /><select data-field="alternative" bind:value={alternative}><option value="two-sided">{t('hypothesis.twoSided')}</option><option value="greater">{t('hypothesis.greater')}</option><option value="less">{t('hypothesis.less')}</option></select></label><label>{t('simulator.seedVyberu')}<Help topic="hypPreview" /><input data-field="seed" bind:value={seed} /></label>
    </section>
  </div>
  {#if previewError}<p class="warning" role="alert">{previewError}</p>{/if}
  {#if population && currentConfig}<div class="population-facts" class:updating={previewPending} aria-busy={previewPending} data-population-ready>
    {#each population.groups as group, g}<div><span>{g ? t('hypothesis.comparisonMeanB') : t('hypothesis.comparisonMeanA')}<Help topic="hypComparison" /></span><strong>{number(group.mean, 2)} {t('simulator.min')}</strong><small>{t('hypothesis.populationGroupDetails', { count: number(population.spec.size), sd: number(group.sd, 2) })}</small></div>{/each}
    <div><span>{t('hypothesis.truth')}<Help topic="hypDifference" /></span><strong>{number(population.truth, 2)} {t('simulator.min')}</strong><small>{t('hypothesis.nullStatement', { operator: currentConfig.alternative === 'greater' ? '≤' : currentConfig.alternative === 'less' ? '≥' : '=', value: number(currentConfig.nullDifference, 2) })}</small></div>
    <div><span>{t('hypothesis.populationD')}<Help topic="hypEffect" /></span><strong data-population-d>{population.cohensD === null ? '—' : number(population.cohensD, 3)}</strong></div>
  </div>{/if}
  {#if activeSpec}<section class="hyp-card preview-panel" aria-busy={previewPending}>
    <p class="card-kicker">{t('hypothesis.previewStep')}<Help topic="hypPreview" /></p><h2>{t('hypothesis.evidence')}<Help topic="hypP" /></h2><p class="note">{t('hypothesis.previewNote')}</p>
    <div class="preview-controls">
      <label>{t('hypothesis.nA')}<Help topic="hypPreview" /><input data-field="previewNA" type="number" min="20" max="2000" step="1" bind:value={nA} /></label><label>{t('hypothesis.nB')}<Help topic="hypPreview" /><input data-field="previewNB" type="number" min="20" max="2000" step="1" bind:value={nB} /></label><button data-action="new-draw" class="button secondary" disabled={!preview || previewPending || !!previewError} onclick={() => { draw++; }}>{t('hypothesis.newDraw')}</button>
      <div class="preview-test-parameters">
        <label>{t('hypothesis.alpha')}<Help topic="hypAlpha" /><output>{number(alpha, 1)} %</output><input data-field="previewAlpha" type="range" min=".1" max="20" step=".1" bind:value={alpha} /></label>
        <div class="preview-null"><div class="null-heading"><label for="preview-null-slider">{t('hypothesis.nullDifference')}<Help topic="hypNullSlider" /></label><input class="delta-number" data-field="previewNullNumber" aria-label={t('hypothesis.nullDifference')} type="number" min="-1000" max="1000" step=".5" bind:value={nullDifference} /></div><input id="preview-null-slider" data-field="previewNullDifference" type="range" min={-nullSliderLimit} max={nullSliderLimit} step=".5" bind:value={nullDifference} /></div>
        <fieldset class="direction-control"><legend>{t('hypothesis.alternative')}<Help topic="hypAlternative" /></legend><div class="direction-options">
          {#each ['less', 'two-sided', 'greater'] as direction}<label><input type="radio" name="preview-alternative" data-direction={direction} value={direction} bind:group={alternative} aria-label={direction === 'less' ? t('hypothesis.less') : direction === 'greater' ? t('hypothesis.greater') : t('hypothesis.twoSided')} /><span>{direction === 'less' ? t('hypothesis.directionLess') : direction === 'greater' ? t('hypothesis.directionGreater') : t('hypothesis.directionTwoSided')}</span></label>{/each}
        </div></fieldset>
      </div>
    </div>
    {#if previewPending}<p class="preview-status" role="status">{t('hypothesis.previewPending')}</p>{/if}
    {#if preview && currentConfig && population}<div class:updating={previewPending}>
      <p class="note preview-sizes">{t('hypothesis.displayedSampleSizes', { nA: number(currentConfig.nA), nB: number(currentConfig.nB) })}</p>
      {#if last}
        <div class="kpis"><div><span>{t('hypothesis.previewDifference')}<Help topic="hypDifference" /></span><strong>{number(last.difference, 2)} {t('simulator.min')}</strong><small class="population-difference" data-population-difference>{t('hypothesis.cardPopulationDifference', { value: number(population.truth, 2) })}</small><small data-difference-error>{t('hypothesis.cardDifferenceError', { value: (last.difference - population.truth > 0 ? '+' : '') + number(last.difference - population.truth, 2) })}</small><small>A: {number(last.meanA, 2)} · B: {number(last.meanB, 2)}</small></div><div><span>{t('hypothesis.interval', { confidence: number((1 - currentConfig.alpha) * 100, 1) })}<Help topic="hypAlternative" /></span><strong class="bounds">{t('hypothesis.intervalBounds', { low: bound(last.low), high: bound(last.high) })}</strong></div><div><span>{t('hypothesis.pValue')}<Help topic="hypP" /></span><strong data-p-value>{pText(last.p)}</strong><small>α = {percent(currentConfig.alpha, 1)}</small></div><div class:rejected={last.reject}><span>{t('hypothesis.title')}</span><strong class="decision" data-decision={last.reject}>{last.reject ? t('hypothesis.reject') : t('hypothesis.retain')}</strong><small>{t('hypothesis.decisionNote')}</small></div></div>
        <div class="test-graphs">
          <section class="test-graph group-means-graph"><h3>{t('hypothesis.meanGraphTitle')}<Help topic="hypMeanGraph" /></h3>
            {#if meanCurves}<DensityPlot series={meanSeries} domain={meanCurves.domain} title={t('hypothesis.meanGraphTitle')} xLabel={t('hypothesis.meanGraphAxis')} markers={meanMarkers} showMarkerLegend />{/if}
            <p class="note">{t('hypothesis.meanGraphNote')}</p>
          </section>
          <section class="test-graph statistic-graph"><h3>{t('hypothesis.evidence')}<Help topic="hypP" /></h3>
            <DensityPlot series={testSeries} domain={testDomain} title={t('hypothesis.evidence')} xLabel={t('hypothesis.statisticAxis')} {regions} markers={[{ value: last.statistic, color: last.reject ? '#c34e4e' : '#153e36', label: `${t('hypothesis.observedT')}: ${number(last.statistic, 3)}` }]} />
            <div class="t-explanation">
              <p class="t-formula">{t('hypothesis.tFormula')}</p>
              <dl class="t-legend">
                <dt>x̄<sub>A</sub>, x̄<sub>B</sub></dt><dd>{t('hypothesis.tMeans')}</dd>
                <dt>Δ₀</dt><dd>{t('hypothesis.tNullDifference')}</dd>
                <dt>SE</dt><dd>{t('hypothesis.tStandardError')}</dd>
                <dt>t</dt><dd>{t('hypothesis.tMeaning')}</dd>
              </dl>
              <p class="note">{t('hypothesis.tSubstitution', { a: number(last.meanA, 3), b: number(last.meanB, 3), null: number(currentConfig.nullDifference, 3), se: number(last.se, 3), statistic: number(last.statistic, 3) })}</p>
            </div>
            <p class="note">{t('hypothesis.testGraphNote')}</p>{#if Math.abs(last.statistic) > testDomain[1]}<p class="note">{t('hypothesis.offScale')}</p>{/if}
          </section>
        </div>
        <details><summary>{t('hypothesis.details')}</summary><p class="note">{t('hypothesis.calculation', { a: number(last.meanA, 3), b: number(last.meanB, 3), difference: number(last.difference, 3), se: number(last.se, 3), null: number(currentConfig.nullDifference, 3), statistic: number(last.statistic, 3), df: number(last.df, 1) })}</p><p class="note">{t('hypothesis.effectCalculation', { a: number(last.meanA, 3), b: number(last.meanB, 3), sdA: number(last.effectSdA, 3), sdB: number(last.effectSdB, 3), d: last.cohensD === null ? '—' : number(last.cohensD, 3) })}</p></details>
      {:else}<p class="warning">{t('hypothesis.invalidCurrent')}</p>{/if}
      <HypothesisComparison {population} current={last} /><p class="note">{t('hypothesis.effectNote')}<Help topic="hypEffect" /></p>
      <button data-action="export-preview" class="button secondary" disabled={exporting || previewPending} onclick={() => download(true)}>{t('hypothesis.downloadPreview')}</button>
    </div>{/if}
  </section>
  <details class="repeat-activity">
    <summary>{t('hypothesis.optionalSimulation')}<Help topic="hypSimulation" /></summary><p class="note">{t('hypothesis.simulationNote')}</p>
    {#if run && runPopulation}<p class="note run-snapshot">{t('hypothesis.runSnapshot', { meanA: number(runPopulation.groups[0].mean, 2), meanB: number(runPopulation.groups[1].mean, 2), nA: number(run.nA), nB: number(run.nB), alpha: percent(run.alpha), method: t('hypothesis.randomSampling') })}</p>{/if}
    {#if runDiffers}<p class="warning">{t('hypothesis.runDiffers')}</p>{/if}
    {#if convergence && run && runPopulation && history.length}<section class="hyp-results"><h2>{t('hypothesis.results')}<Help topic="hypErrors" /></h2><p class="note">{nullTrue ? t('hypothesis.nullTrue') : t('hypothesis.nullFalse')} {t('hypothesis.validCounts', { valid: number(convergence.valid), total: number(history.length), skipped: number(convergence.skipped) })}</p>
      <div class="kpis"><div><span>{t('hypothesis.average')}</span><strong>{convergence.average === null ? '—' : number(convergence.average, 2)}</strong><small>{t('hypothesis.truth')}: {number(runPopulation.truth, 2)}</small></div><div><span>{t('hypothesis.missed')}</span><strong>{convergence.valid ? percent(convergence.missed / convergence.valid) : '—'}</strong></div><div><span>{nullTrue ? t('hypothesis.typeI') : t('hypothesis.typeII')}<Help topic="hypErrors" /></span><strong>{convergence.valid ? percent(convergence.wrong / convergence.valid) : '—'}</strong></div><div><span>{nullTrue ? t('hypothesis.rejectionRate') : t('hypothesis.power')}<Help topic="hypErrors" /></span><strong>{convergence.valid ? percent(convergence.rejected / convergence.valid) : '—'}</strong></div></div>
    </section>{/if}
    <div class="run-bar"><div><label>{t('simulator.pocetOpakovani')}<Help topic="hypSimulation" /><input data-field="repeats" type="number" min="1" max={MAX_REPEATS} step="1" bind:value={repeats} disabled={busy} /></label><strong>{run ? t('simulator.progress', { completed: number(history.length), total: number(run.repeats) }) : t('hypothesis.ready')}</strong>
      {#if run}<progress value={history.length} max={run.repeats} aria-label={t('simulator.prubehSimulace')}></progress><small data-status={status}>{status === 'running' ? t('simulator.simulaceBezi') : status === 'paused' ? t('simulator.pozastaveno') : status === 'stopped' ? t('simulator.zastaveno') : status === 'completed' ? t('simulator.dokonceno') : ''} · {t('hypothesis.randomSampling')}</small>{/if}
      {#if runGenerating && run}<progress value={runGenerated} max={run.population.size * 2} aria-label={t('simulator.prubehVytvareniPopulace')}></progress><small>{t('hypothesis.generated', { completed: number(runGenerated), total: number(run.population.size * 2) })}</small>{/if}</div>
      <div class="run-actions"><label class="toggle"><input data-field="forest" type="checkbox" bind:checked={showForest} />{t('simulator.zobrazitIntervaloveLesy')}<Help topic="hypForest" /></label><label class="speed">{t('simulator.rychlost')}<Help topic="speed" /><output>{speed === 0 ? t('simulator.bezAnimace') : `${number(speed, 1)}×`}</output><input data-field="speed" type="range" min="0" max="8" step=".5" value={speed} oninput={event => changeSpeed(Number(event.currentTarget.value))} /></label><button data-action="start" class="button primary" disabled={busy || previewPending || !preview} onclick={start}>{history.length ? t('simulator.spustitNovouSimulaci') : t('hypothesis.startSimulation')}</button>{#if busy}<button data-action="pause" class="button secondary" onclick={pause}>{status === 'paused' ? t('simulator.pokracovat') : t('simulator.pozastavit')}</button><button data-action="stop" class="button ghost" onclick={stop}>{t('simulator.zastavit')}</button>{/if}</div>
    </div>
    {#if convergence && run && runPopulation && history.length}<section class="hyp-results">
      <section class="hyp-card convergence-card">
        <h3>{nullTrue ? t('hypothesis.typeIConvergence') : t('hypothesis.typeIIConvergence')}<Help topic="hypErrors" /></h3>
        <p class="note">{nullTrue ? t('hypothesis.typeIExplanation') : t('hypothesis.typeIIExplanation')}</p>
        {#if nullTrue}<p class="note">{Math.abs(runPopulation.truth - run.nullDifference) <= 1e-10 ? t('hypothesis.typeIBoundaryExplanation', { alpha: percent(run.alpha) }) : t('hypothesis.typeIInteriorExplanation', { alpha: percent(run.alpha) })}</p>{/if}
        {#if convergence.valid}<div class="convergence-plot"><Plot points={convergence.decision} title={nullTrue ? t('hypothesis.typeIConvergence') : t('hypothesis.typeIIConvergence')} xLabel={t('simulator.opakovanyVyber')} yLabel={t('simulator.mimo')} reference={nullTrue ? run.alpha * 100 : convergence.wrong / convergence.valid * 100} referenceLabel={nullTrue ? 'α' : t('hypothesis.observedBeta')} horizontal kind="line" color="#6676b4" domain={[1, Math.max(2, run.repeats)]} currentSample={history.length} totalSamples={run.repeats} /></div>{/if}
      </section>
      <HypothesisComparison population={runPopulation} current={history.at(-1)?.result ?? null} averages={convergence} />
      {#if showForest}<HypothesisForest {history} truth={runPopulation.truth} nullDifference={run.nullDifference} />{/if}
    </section>{/if}
    <section class="hyp-export"><h2>{t('hypothesis.exportTitle')}</h2><p class="note">{t('hypothesis.exportNote')}</p><button data-action="export" class="button secondary" disabled={!history.length || exporting} onclick={() => download(false)}>{exporting ? t('hypothesis.exporting') : t('hypothesis.download')}</button></section>
  </details>{/if}
  {#if error}<p class="warning" role="alert">{error}</p>{/if}
  {#if exporting}<progress value={exportProgress} max={exportTotal} aria-label={t('export.prubehPripravyExportu')}></progress>{/if}{#if exportUrl}<p class="note export-ready">{exportedLabel} · {t('hypothesis.exportReady')} <a href={exportUrl} download="testovani-hypotez.xlsx">{t('export.stahnoutZnovu')}</a></p>{/if}
  <details class="methodology"><summary>{t('hypothesis.methodology')}</summary><p class="note">{t('hypothesis.methodologyText')}</p><a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda353.htm" target="_blank" rel="noreferrer">{t('hypothesis.source')}</a><p class="note">{t('hypothesis.effectNote')}</p><a href="https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/hedgeg.htm" target="_blank" rel="noreferrer">{t('hypothesis.effectSource')}</a></details>
</section>

<style>
  .t-explanation{margin:18px 0;padding:16px;background:#f5f8f0;border:1px solid #dce6d4}.t-formula{margin:0 0 14px;font-size:18px;line-height:1.8;overflow-wrap:anywhere}.t-legend{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 14px;margin:0;font-size:12px;line-height:1.8}.t-legend dt{font-weight:600;color:#153e36}.t-legend dd{margin:0;color:#315c55}.t-explanation .note{margin-bottom:0}
  .kpis .population-difference{font-weight:600;color:#285c4a;border-top:1px solid #dce6d4;margin-top:6px;padding-top:8px}

  .preview-test-parameters{grid-column:1/-1;display:grid;grid-template-columns:1fr 1.2fr 1.3fr;gap:24px;align-items:start;border-top:1px solid #dce6d4;padding-top:18px}.null-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:26px}.null-heading label{line-height:1.5}.null-heading .delta-number{width:85px;flex-shrink:0;margin:0;padding:4px 6px}.direction-control{border:0;padding:0;margin:0;min-width:0}.direction-control legend{font-size:12px;color:#315c55;padding:0;line-height:1.5}.direction-options{display:flex;gap:0;margin-top:8px}.direction-options label{flex:1;position:relative;min-width:0}.direction-options input{position:absolute;opacity:0;width:1px;height:1px;margin:0}.direction-options span{display:block;text-align:center;white-space:nowrap;padding:10px 4px;border:1px solid #cbd8c1;background:#fafcf8;font-size:11px}.direction-options label+label span{border-left:0}.direction-options input:checked+span{background:#287766;color:white;border-color:#287766}.direction-options input:focus-visible+span{outline:3px solid #b56832;outline-offset:2px;position:relative;z-index:1}@media(max-width:1000px){.preview-test-parameters{grid-template-columns:1fr 1fr}.direction-control{grid-column:1/-1}}@media(max-width:800px){.preview-test-parameters{grid-template-columns:1fr;gap:18px}.direction-control{grid-column:auto}}

  .test-graphs{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}.test-graph{min-width:0;padding:18px;border:1px solid var(--line);background:#fff}.test-graph h3{min-height:44px;font-size:16px;line-height:1.6}@media(max-width:1000px){.test-graphs{grid-template-columns:1fr}.test-graph h3{min-height:0}}

  .hypothesis-lab{padding-top:24px;border-top:1px solid var(--line)}.setup-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.hyp-card{background:#fff;border:1px solid var(--line);padding:24px;min-width:0}h2{font-size:21px;margin:8px 0 18px}h3{font-size:16px;margin:0 0 12px}.note{font-size:12px;color:#697c6d;line-height:1.85;margin:12px 0}.fields{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}label{font-size:12px;color:#315c55;display:block;margin:12px 0}input,select{width:100%;margin-top:8px;padding:11px 10px;background:#fafcf8;border:1px solid #cbd8c1;border-radius:3px;font:inherit;color:#153e36;min-width:0}input[type=range]{padding:0;accent-color:#287766}details{margin:18px 0;font-size:12px}summary{cursor:pointer;font-weight:600;line-height:1.8}button:disabled{opacity:.5;cursor:default}output{float:right;margin-left:8px}.generation{font-size:12px;line-height:1.9;margin-top:14px}.generation strong,.generation span{display:block}progress{display:block;width:100%;height:8px;margin:10px 0;accent-color:#287766}.population-facts{display:grid;grid-template-columns:repeat(4,1fr);padding:20px;background:#edf4e6;margin:16px 0;gap:20px}.population-facts span,.population-facts small{display:block;font-size:11px;color:#6a7e6b}.population-facts strong{display:block;font:22px 'DM Mono',monospace;margin:10px 0}.run-actions{max-width:500px;align-items:center}.toggle{display:flex;align-items:center;gap:8px;margin:0}.toggle input{width:auto;margin:0}.speed{min-width:170px;margin:0}.run-bar{align-items:center}.run-bar strong{font-size:15px}.run-bar small{display:block;font-size:11px}.run-bar input[type=number]{max-width:180px}.warning{background:#fff4e8;color:#895735;border:1px solid #edcfad;padding:14px;font-size:12px;line-height:1.8}.preview-panel{margin:26px 0}.preview-controls{display:grid;grid-template-columns:1fr 1fr auto;gap:24px;align-items:center;padding:16px 20px;background:#f1f6eb;border:1px solid #dce6d4}.preview-controls label{margin:0}.preview-status{font-size:12px;color:#426c4c;background:#edf4e6;padding:12px}.updating{opacity:.5}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0}.kpis>div{background:#f5f8f0;border:1px solid #dce6d4;padding:16px}.kpis span,.kpis small{display:block;font-size:11px;color:#697c6d;line-height:1.7}.kpis strong{display:block;font:23px 'DM Mono',monospace;color:#285c4a;margin:12px 0;overflow-wrap:anywhere}.kpis .bounds,.kpis .decision{font-size:16px}.kpis .rejected{background:#fff1e5;border-color:#efd1b4}.repeat-activity{padding:24px;border:1px solid var(--line);background:#fafcf8;margin-top:28px}.repeat-activity>summary{font-size:20px}.hyp-results{margin-top:30px}.convergence-card{margin:20px 0}.convergence-plot{max-width:800px;margin-inline:auto}.methodology,.hyp-export{margin-top:28px;border-top:1px solid var(--line);padding-top:24px}.methodology a{font-size:12px}.hyp-export .note{max-width:850px}@media(max-width:800px){.setup-grid{grid-template-columns:1fr}.hyp-card,.repeat-activity{padding:18px}.kpis{grid-template-columns:1fr 1fr}.population-facts{grid-template-columns:1fr 1fr}.preview-controls{grid-template-columns:1fr;padding:16px;gap:16px}.preview-controls button{justify-self:start}.run-actions{max-width:none}.fields{gap:8px 12px}.population-facts strong{font-size:19px}}
</style>
