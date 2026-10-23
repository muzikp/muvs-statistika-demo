<script lang="ts">
  import { t } from '../lib/texts';

  import { onMount } from 'svelte';
  import { MAX_POPULATION, MAX_REPEATS, AGE_GROUPS, SEXES, EDUCATION, PHONES, DEFAULT_SHARES, METHODS, INTERVAL_METHODS, createSummary, validatePopulation, validateSampling, samplingConvergence, type Method, type IntervalMethod, type Population, type PopulationSpec, type SamplingConfig, type SamplingMessage, type MomentSummary, type SamplingIteration } from '../lib/sampling';
  import { number, percent } from '../lib/format';
  import Plot from './Plot.svelte';
  import Help from './Help.svelte';
  import SampleForest from './SampleForest.svelte';
  import ExportPanel from './ExportPanel.svelte';
  import NetworkViewer from './NetworkViewer.svelte';
  import { samplingHistogram } from '../lib/plots';
  import { loadPreferences, savePreferences } from '../lib/preferences';

  let populationSize = $state(50000), populationSeed = $state('telefony-2026'), shares = $state([...DEFAULT_SHARES]);
  let population = $state.raw<Population>({ spec: { size: 50000, seed: 'telefony-2026', shares: [...DEFAULT_SHARES] }, people: [], cells: [], apple: 0, minutes: 0 });
  let generating = $state(true), preparingPopulation = $state(false), generatedPeople = $state(0), generationTotal = $state(50000);
  let populationWorker: Worker | null = null;
  const populationReady = $derived(population.people.length > 0);
  let n = $state(300), repeats = $state(200), confidence = $state(95), seed = $state('vybery-2026');
  let demographicBias = $state(1), outcomeBias = $state(0);
  let status = $state<'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'>('idle');
  let error = $state(''), completed = $state(0), summary = $state.raw(createSummary().random);
  let history = $state.raw<SamplingIteration[]>([]);
  let runConfig = $state.raw<SamplingConfig | null>(null);
  let selectedMethod = $state<Method>('random'), intervalMethod = $state<IntervalMethod>('wald'), speed = $state(4);
  let showForest = $state(true);
  let preferencesLoaded = $state(false);
  let worker: Worker | null = null;
  const busy = $derived(status === 'running' || status === 'paused');
  const selected = $derived(METHODS.find(method => method.id === selectedMethod)!);
  const current = $derived(METHODS.find(method => method.id === (runConfig?.method ?? selectedMethod))!);
  const nonprobability = $derived(selectedMethod === 'convenience' || selectedMethod === 'weighted' || selectedMethod === 'network');
  const pending = $derived(populationSize !== population.spec.size || populationSeed !== population.spec.seed || shares.some((share, i) => share !== population.spec.shares[i]));
  const shareTotal = $derived(shares.reduce((sum, value) => sum + Number(value), 0));
  const variables = [{ id: 'apple', title: t('simulator.podilUzivateluApple'), unit: 'p. b.' }, { id: 'minutes', title: t('simulator.prumerMinutNaInternetuZaTyden'), unit: t('simulator.min') }] as const;
  type NumericSummary = { count: number; mean: number; median: number; sd: number; min: number; max: number; bins: { from: number; to: number; count: number }[] };
  type CategoricalSummary = { label: string; count: number; share: number }[];
  function summarize(values: number[], binCount = 12): NumericSummary {
    if (!values.length) return { count: 0, mean: 0, median: 0, sd: 0, min: 0, max: 0, bins: [] };
    const sorted = [...values].sort((a, b) => a - b), mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1) : 0;
    const min = sorted[0], max = sorted[sorted.length - 1], median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const width = max > min ? (max - min) / binCount : 1, bins = Array.from({ length: binCount }, (_, index) => ({ from: min + index * width, to: min + (index + 1) * width, count: 0 }));
    for (const value of values) bins[Math.min(binCount - 1, Math.max(0, Math.floor((value - min) / width)))].count++;
    return { count: values.length, mean, median, sd: Math.sqrt(variance), min, max, bins };
  }
  function categorical(values: number[], labels: string[]): CategoricalSummary { const counts = labels.map(() => 0); for (const value of values) if (counts[value] !== undefined) counts[value]++; return labels.map((label, index) => ({ label, count: counts[index], share: values.length ? counts[index] / values.length : 0 })).filter(item => item.count > 0); }
  const populationNumeric = $derived.by(() => ({ age: summarize(population.people.map(person => person.age)), minutes: summarize(population.people.map(person => person.minutes)) }));
  const populationCategorical = $derived.by(() => ({ sex: categorical(population.people.map(person => person.sex), SEXES), education: categorical(population.people.map(person => person.education), EDUCATION), phone: categorical(population.people.map(person => person.phone), PHONES) }));
  const fmt = (value: number, variable: 'apple' | 'minutes') => variable === 'apple' ? percent(value, 1) : t('simulator.valueMin', { value: number(value, 1) });
  const difference = (value: number, variable: 'apple' | 'minutes') => `${value > 0 ? '+' : ''}${number(value * (variable === 'apple' ? 100 : 1), 1)}`;
  const average = (metric: MomentSummary) => metric.sum / metric.count;
  const cellName = (h: number) => `${AGE_GROUPS[Math.floor(h / 2)]} · ${SEXES[h % 2]}`;
  const draftSpec = (): PopulationSpec => ({ size: Number(populationSize), seed: populationSeed, shares: shares.map(Number) });
  function rebuild() {
    if (busy) return;
    const spec = draftSpec(), errors = validatePopulation(spec);
    if (errors.length) { error = errors[0]; generating = false; return; }
    populationWorker?.terminate(); generating = true; generatedPeople = 0; generationTotal = spec.size; error = '';
    summary = createSummary().random; history = []; completed = 0; runConfig = null; status = 'idle';
    try {
      const generationWorker = new Worker(new URL('../lib/sampling.worker.ts', import.meta.url), { type: 'module' });
      populationWorker = generationWorker;
      generationWorker.addEventListener('message', ({ data }: MessageEvent<SamplingMessage>) => {
        if (populationWorker !== generationWorker) return;
        if (data.type === 'population-progress') { generatedPeople = data.completed; generationTotal = data.total; }
        else if (data.type === 'population-ready') { population = data.population; generatedPeople = population.people.length; generating = false; generationWorker.terminate(); populationWorker = null; }
        else if (data.type === 'error') { error = data.message; generating = false; generationWorker.terminate(); populationWorker = null; }
      });
      generationWorker.addEventListener('error', () => { if (populationWorker !== generationWorker) return; error = t('simulator.populaciSeNepodariloVytvoritZkusteToZnovu'); generating = false; generationWorker.terminate(); populationWorker = null; });
      generationWorker.postMessage({ type: 'generate', spec: JSON.parse(JSON.stringify(spec)) });
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); generating = false; }
  }
  function normalize() {
    if (!Number.isFinite(shareTotal) || shareTotal <= 0) { error = t('simulator.nejprveVyplnteKladneDemografickePodily'); return; }
    shares = shares.map(value => Math.round(Number(value) / shareTotal * 10000) / 100);
    shares[shares.length - 1] = Math.round((100 - shares.slice(0, -1).reduce((sum, x) => sum + x, 0)) * 100) / 100;
  }
  function start() {
    if (generating || !populationReady || pending || busy) return;
    const config: SamplingConfig = { population: population.spec, n: Number(n), repeats: Number(repeats), confidence: Number(confidence) / 100, seed, demographicBias: Number(demographicBias), outcomeBias: Number(outcomeBias), method: selectedMethod, intervalMethod };
    const errors = validateSampling(config);
    if (errors.length) { error = errors[0]; return; }
    worker?.terminate(); error = ''; completed = 0; summary = createSummary()[selectedMethod]; history = []; runConfig = config; status = 'running';
    preparingPopulation = true; generatedPeople = 0; generationTotal = population.spec.size;
    try {
      worker = new Worker(new URL('../lib/sampling.worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', ({ data }: MessageEvent<SamplingMessage>) => {
        if (data.type === 'population-progress') { generatedPeople = data.completed; generationTotal = data.total; return; }
        if (data.type === 'population-ready') return;
        preparingPopulation = false;
        if (data.type === 'error') { error = data.message; status = 'error'; worker?.terminate(); return; }
        completed = data.completed; summary = data.summary; history = data.history;
        if (data.type === 'completed') { status = 'completed'; worker?.terminate(); }
      });
      worker.addEventListener('error', () => { error = t('simulator.vypocetSeNepodariloDokoncitSpustteJejZnovu'); status = 'error'; preparingPopulation = false; worker?.terminate(); });
      worker.postMessage({ type: 'simulate', config: JSON.parse(JSON.stringify(config)), speed });
    } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); status = 'error'; preparingPopulation = false; }
  }
  function pause() { if (status === 'paused') { worker?.postMessage({ type: 'resume' }); status = 'running'; } else { worker?.postMessage({ type: 'pause' }); status = 'paused'; } }
  function stop() { worker?.terminate(); status = 'stopped'; preparingPopulation = false; }
  function setSpeed(value: number) { speed = value; if (busy) worker?.postMessage({ type: 'speed', speed }); }
  $effect(() => {
    if (!preferencesLoaded) return;
    savePreferences('simulator', { populationSize, populationSeed, shares, n, repeats, confidence, seed, demographicBias, outcomeBias, selectedMethod, intervalMethod, speed, showForest });
  });
  onMount(() => {
    const saved = loadPreferences<Partial<{ populationSize: number; populationSeed: string; shares: number[]; n: number; repeats: number; confidence: number; seed: string; demographicBias: number; outcomeBias: number; selectedMethod: Method; intervalMethod: IntervalMethod; speed: number; showForest: boolean }>>('simulator', {});
    if (Number.isFinite(saved.populationSize)) populationSize = saved.populationSize!;
    if (typeof saved.populationSeed === 'string') populationSeed = saved.populationSeed;
    if (Array.isArray(saved.shares) && saved.shares.length === shares.length && saved.shares.every(value => Number.isFinite(value))) shares = saved.shares;
    if (Number.isFinite(saved.n)) n = saved.n!;
    if (Number.isFinite(saved.repeats)) repeats = saved.repeats!;
    if (Number.isFinite(saved.confidence)) confidence = saved.confidence!;
    if (typeof saved.seed === 'string') seed = saved.seed;
    if (Number.isFinite(saved.demographicBias)) demographicBias = saved.demographicBias!;
    if (Number.isFinite(saved.outcomeBias)) outcomeBias = saved.outcomeBias!;
    if (saved.selectedMethod && METHODS.some(method => method.id === saved.selectedMethod) && saved.selectedMethod !== 'convenience') selectedMethod = saved.selectedMethod;
    if (saved.intervalMethod && INTERVAL_METHODS.some(method => method.id === saved.intervalMethod)) intervalMethod = saved.intervalMethod;
    if (Number.isFinite(saved.speed)) speed = saved.speed!;
    if (typeof saved.showForest === 'boolean') showForest = saved.showForest;
    preferencesLoaded = true;
    rebuild();
    return () => { worker?.terminate(); populationWorker?.terminate(); };
  });
</script>

<section class="sampling-lab" aria-label={t('simulator.simulaceIntervaluSpolehlivosti')}>
  <div class="sampling-intro"><div><p class="eyebrow">{t('simulator.jednaPopulaceDvaUkazateleJednaMetodaVyberu')}</p><h2>{t('simulator.losujteVzorkySledujteOdhadyIChyby')}</h2><p>{t('simulator.zvolteMetoduVyberuAOpakovaneOdhadujtePodilUzivatelu')}</p></div><span class="synthetic-badge">{t('simulator.smyslenaPopulace')}<br />{t('simulator.nejdeODataOCr')}</span></div>
  <fieldset aria-busy={busy || generating} class="sampling-settings">
    <legend class="sr-only">{t('simulator.nastaveniPopulaceAVyberu')}</legend>
    <div class="sampling-setup">
      <section class="sampling-card">
        <p class="card-kicker">{t('simulator.krok01SpolecnaPopulace')}<Help topic="populationStep" /></p><h3>{t('simulator.kohoBudemeZkoumat')}</h3>
        <div class="sampling-fields"><label>{t('simulator.pocetLidiVPopulaci')}<Help topic="populationSize" /><input disabled={busy || generating} type="number" min="10000" max={MAX_POPULATION} step="10000" bind:value={populationSize} /></label><label>{t('simulator.seedPopulace')}<Help topic="populationSeed" /><input disabled={busy || generating} bind:value={populationSeed} /></label></div>
        <p class="sampling-note">{t('simulator.vekPohlaviAVzdelaniSouvisejiSTelefonemI')}</p>
        <details><summary>{t('simulator.upravitSlozeniPopulaceVekPohlavi')}<Help topic="demographics" /></summary>
          <p class="sampling-note">{t('simulator.spolecnePodilySkupinSlouziJakoZnameCilePro')}</p>
          <div class="sampling-demographics">{#each shares as _, h}<label>{cellName(h)} (%)<Help topic="demographicShare" /><input disabled={busy || generating} type="number" min="2" max="60" step="0.1" bind:value={shares[h]} /></label>{/each}</div>
          <div class="sampling-inline"><span>{t('simulator.soucet')} {number(shareTotal, 2)} %</span><button disabled={busy || generating} class="button ghost" onclick={normalize}>{t('simulator.normalizovatNa100')}</button><Help topic="normalize" /></div>
        </details>
        <button disabled={busy || generating} class="button secondary" onclick={rebuild}>{generating ? t('simulator.vytvarimPopulaci') : t('simulator.vytvoritPopulaci')}</button><Help topic="createPopulation" />
        <div class="population-generation"><span>{t('simulator.prubehVytvareniPopulace')}<Help topic="generation" /></span><div aria-live="polite" aria-atomic="true" aria-busy={generating || preparingPopulation}>
          {#if generating || preparingPopulation}<p role="status">{preparingPopulation ? t('simulator.pripravujiPopulaciProSimulaci') : t('simulator.vytvarimPopulaci')} <strong>{number(generatedPeople)} / {number(generationTotal)} {t('simulator.lidi')}{percent(generatedPeople / generationTotal, 0)})</strong></p><progress value={generatedPeople} max={generationTotal} aria-label={t('simulator.prubehVytvareniPopulace')}></progress>
          {:else if populationReady}<p role="status">{t('simulator.populacePripravena')} {number(population.people.length)} {t('simulator.lidi2')}</p>{/if}
        </div>
        </div>
        {#if pending}<p class="sampling-pending">{t('simulator.nastaveniPopulaceSeZmeniloPredSimulaciVytvorteNovou')}</p>{/if}
      </section>
      {#if populationReady}
        <details class="population-summary-card">
          <summary>{t('simulator.populacniStatistiky')}<Help topic="populationStep" /></summary>
          <p class="sampling-note">{t('simulator.populacniStatistikyPopis')}</p>
          <div class="population-stat-grid">
            {#each [{ key: 'age', title: t('simulator.vek') }, { key: 'minutes', title: t('simulator.internetMinTyden') }] as item}
              {@const stat = populationNumeric[item.key as 'age' | 'minutes']}
              <section class="population-stat-block"><h4>{item.title}</h4><dl><div><dt>{t('simulator.pocet')}</dt><dd>{number(stat.count)}</dd></div><div><dt>{t('simulator.prumer')}</dt><dd>{number(stat.mean, 1)}</dd></div><div><dt>{t('simulator.median')}</dt><dd>{number(stat.median, 1)}</dd></div><div><dt>{t('simulator.smerodatnaOdchylka')}</dt><dd>{number(stat.sd, 1)}</dd></div><div><dt>{t('simulator.minimum')}</dt><dd>{number(stat.min, 1)}</dd></div><div><dt>{t('simulator.maximum')}</dt><dd>{number(stat.max, 1)}</dd></div></dl><div class="population-histogram" aria-label={item.title}>{#each stat.bins as bin}<span style={`height:${Math.max(3, bin.count / Math.max(...stat.bins.map(value => value.count)) * 100)}%`} title={`${number(bin.from, 1)}-${number(bin.to, 1)}: ${number(bin.count)} ${t('simulator.lidi2')}`}></span>{/each}</div></section>
            {/each}
          </div>
          <div class="population-category-grid">
            {#each [{ key: 'sex', title: t('simulator.pohlavi') }, { key: 'education', title: t('simulator.vzdelani') }, { key: 'phone', title: t('simulator.telefon') }] as item}
              {@const categories = populationCategorical[item.key as 'sex' | 'education' | 'phone']}
              <section class="population-stat-block"><h4>{item.title}</h4><div class="population-bars">{#each categories as category}<div class="population-bar-row"><span>{category.label}</span><div><i style={`width:${category.share * 100}%`}></i></div><strong>{percent(category.share, 1)}</strong></div>{/each}</div></section>
            {/each}
          </div>
          <NetworkViewer {population} />
        </details>
      {/if}
      <section class="sampling-card">
        <p class="card-kicker">{t('simulator.krok02Vybery')}<Help topic="samplingStep" /></p><h3>{t('simulator.jakBudemeLidiVybirat')}</h3>
        <label>{t('simulator.metodaVyberu')}<Help topic="method" /><select disabled={busy || generating} bind:value={selectedMethod}>{#each METHODS.filter(method => method.id !== 'convenience') as method}<option value={method.id}>{method.name}</option>{/each}</select></label>
        <label>{t('simulator.metodaIntervalu')}<Help topic="intervalMethod" /><select disabled={busy || generating} bind:value={intervalMethod}>{#each INTERVAL_METHODS as method}<option value={method.id}>{method.name}</option>{/each}</select></label>
        <p class="sampling-note">{selected.description}</p>
        <div class="sampling-fields"><label>{t('simulator.velikostKazdehoVzorkuN')}<Help topic="sampleSize" /><input disabled={busy || generating} type="number" min="80" max="2000" step="20" bind:value={n} /></label><label>{t('simulator.pocetOpakovani')}<Help topic="repetitions" /><input disabled={busy || generating} type="number" min="1" max={MAX_REPEATS} step="1" bind:value={repeats} /></label><label>{t('simulator.spolehlivost')}<Help topic="confidence" /><input disabled={busy || generating} type="number" min="80" max="99" step="1" bind:value={confidence} /></label><label>{t('simulator.seedVyberu')}<Help topic="sampleSeed" /><input disabled={busy || generating} bind:value={seed} /></label></div>
        {#if nonprobability}
        <label>{t('simulator.demografickeZkresleniPrilezitostnehoSberu')}<Help topic="demographicBias" /> <output>{number(demographicBias, 1)}×</output><input disabled={busy || generating} type="range" min="0" max="2" step="0.25" bind:value={demographicBias} /></label>
        <p class="sampling-note">{t('simulator.text0BezDemografickePreferenceVyssiHodnotaZvyhodnujeMladsi')}</p>
        <label>{t('simulator.zkresleniUvnitrSkupin')}<Help topic="outcomeBias" /> <output>{number(outcomeBias, 1)}×</output><input disabled={busy || generating} type="range" min="0" max="2" step="0.25" bind:value={outcomeBias} /></label>
        <p class="sampling-note">{t('simulator.text0DostupnostZavisiJenNaDemografiiVyssiHodnota')}</p>
        {/if}
      </section>
    </div>
  </fieldset>
  {#if populationReady}
  <div class="population-facts"><div><span>{t('simulator.skutecnaPopulace')}<Help topic="populationStep" /></span><strong>{number(population.people.length)} {t('simulator.lidi2')}</strong></div><div><span>{t('simulator.podilApple')}<Help topic="apple" /></span><strong>{percent(population.apple, 2)}</strong></div><div><span>{t('simulator.internetPopulacniPrumer')}<Help topic="minutes" /></span><strong>{number(population.minutes, 1)} {t('simulator.minTyden')}</strong></div></div>
  {/if}
  {#if error}<p class="sampling-error" role="alert">{error}</p>{/if}
  <div class="sampling-run"><div><p class="card-kicker">{t('simulator.krok03Simulace')}<Help topic="simulation" /></p><strong>{completed ? t('simulator.progress', { completed: number(completed), total: number(runConfig?.repeats ?? 0) }) : t('simulator.kazdyVzorekPoskytneOdhadObouVelicin')}</strong>{#if runConfig}<progress value={completed} max={runConfig.repeats} aria-label={t('simulator.prubehSimulace')}></progress><span class="sampling-status" role="status">{status === 'running' ? t('simulator.simulaceBezi') : status === 'paused' ? t('simulator.pozastaveno') : status === 'stopped' ? t('simulator.zastaveno') : status === 'completed' ? t('simulator.dokonceno') : ''} · {current.name} {t('simulator.n')} {runConfig.n} {t('simulator.spolehlivost2')} {percent(runConfig.confidence, 0)}</span>{/if}</div><div class="sampling-actions"><label class="sampling-forest-toggle"><input type="checkbox" bind:checked={showForest} /> {t('simulator.zobrazitIntervaloveLesy')}<Help topic="forestToggle" /></label><label class="sampling-speed">{t('simulator.rychlost')}<Help topic="speed" /> <output>{speed === 0 ? t('simulator.bezAnimace') : `${number(speed, 1)}×`}</output><input type="range" min="0" max="8" step="0.5" value={speed} oninput={event => setSpeed(Number(event.currentTarget.value))} /></label><button class="button primary" disabled={busy || generating || !populationReady || pending} onclick={start}>{completed ? t('simulator.spustitNovouSimulaci') : t('simulator.spustitSimulaci')}</button>{#if busy}<button class="button secondary" onclick={pause}>{status === 'paused' ? t('simulator.pokracovat') : t('simulator.pozastavit')}</button><button class="button ghost" onclick={stop}>{t('simulator.zastavit')}</button>{/if}</div></div>
  {#if completed && runConfig}
    <section class="sampling-results" aria-label={t('simulator.vysledkySimulace')}>
      <div class="sampling-section-title"><div><p class="eyebrow">{t('simulator.obaUkazateleZeStejnychVzorku')}</p><h2>{t('simulator.konvergenceAIntervaly')}</h2></div><span>{current.name} · {percent(runConfig.confidence, 0)} {t('simulator.intervaly')}</span></div>
      {#if runConfig.method === 'weighted' || runConfig.method === 'convenience' || runConfig.method === 'network'}<p class="sampling-note">{t('simulator.intervalyPrilezitostnehoSberuJsouPracovniAproximaciKteraNeobsahuje')}</p>{/if}
      {#if summary.skipped}<p class="sampling-error">{t('simulator.v')} {summary.skipped} {t('simulator.z')} {completed} {t('simulator.vyberuNemelaNekteraSkupinaAlespon2OsobyOdhad')}</p>{/if}
      <div class="sampling-outcomes">
        {#each variables as variable}
          {@const metric = summary[variable.id]}
          {@const last = summary.last?.estimates?.[variable.id]}
          <article class="sampling-outcome">
            <h3>{variable.title}<Help topic={variable.id === 'apple' ? 'apple' : 'minutes'} /></h3>
            <div class="sampling-kpis">
              <div class="sampling-kpi actual"><span>{t('simulator.skutecnaPopulacniHodnota')}<Help topic="truth" /></span><strong>{fmt(population[variable.id], variable.id)}</strong></div>
              <div class="sampling-kpi"><span>{t('simulator.posledniOdhad')}<Help topic="lastEstimate" /></span><strong>{last ? fmt(last.estimate, variable.id) : t('simulator.nelzeOdhadnout')}</strong><small>{last ? t('simulator.intervalLastlowLasthigh', { lastLow: fmt(last.low, variable.id), lastHigh: fmt(last.high, variable.id) }) : t('simulator.nedostatekOsobVNektereSkupine')}</small></div>
              <div class="sampling-kpi"><span>{t('simulator.prumerVsechPlatnychOdhadu')}<Help topic="averageEstimate" /></span><strong>{metric.count ? fmt(average(metric), variable.id) : '—'}</strong><small>{metric.count ? t('simulator.odSkutecnostiDifferenceaveragemetricpopulationVariableunit', { differenceAverageMetricPopulation: difference(average(metric) - population[variable.id], variable.id), variableUnit: variable.unit }) : t('simulator.zatimZadnyPlatnyOdhad')}</small></div>
              <div class="sampling-kpi"><span>{t('simulator.intervalyMimoSkutecnost')}<Help topic="outside" /></span><strong>{metric.count ? percent((metric.count - metric.covered) / metric.count, 1) : '—'}</strong><small>{metric.count - metric.covered} {t('simulator.z')} {metric.count} {t('simulator.platnychIntervalu')}</small></div>
            </div>
            {#if runConfig.repeats > 1}{@const distribution = samplingHistogram(history, variable.id, population[variable.id])}<section class="sampling-histogram" aria-label={t('simulator.histogramOdhaduVariabletitle', { variableTitle: variable.title })}>
              <h4>{t('simulator.rozdeleni')} {variable.id === 'apple' ? t('simulator.odhaduPodiluApple') : t('simulator.vyberovychPrumeruCasu')}<Help topic="histogram" /></h4>
              <p>{t('simulator.histogramVsech')} {distribution.count} {t('simulator.platnychOdhaduKazdyVzorekPridavaJedenOdhadSirka')} {number(distribution.width, distribution.width < 1 ? 2 : 1)} {variable.unit}.</p>
              {#if distribution.count}
                <Plot points={distribution.points} domain={distribution.domain} barWidth={distribution.width} reference={distribution.reference} referenceLabel={variable.id === 'apple' ? t('simulator.skutecnyPodilApple') : t('simulator.skutecnyPrumerMinTyden')} title={t('simulator.rozdeleniOdhaduVariabletitle', { variableTitle: variable.title })} xLabel={variable.id === 'apple' ? t('simulator.odhadPodiluApple') : t('simulator.odhadPrumeruMinTyden')} yLabel={t('simulator.pocetVyberu')} color={current.color} barOpacity={0.5} secondaryPoints={distribution.normal} secondaryColor="#c34e4e" currentSample={completed} totalSamples={runConfig.repeats} />
                <p class="distribution-note">{t('simulator.sloupceZiskaneOdhadyCervenaSvisliceSkutecnost')}{#if distribution.normal.length} {t('simulator.oranzovaKrivkaNormalniRozdeleniSeStredemVeSkutecne')}{:else} {t('simulator.krivkuDoplnimeAzBudeViceOdlisnychOdhadu')}{/if}</p>
              {:else}<p>{t('simulator.zatimNeniKDispoziciPlatnyOdhadProHistogram')}</p>{/if}
            </section>
            <section class="sampling-convergence" aria-label={t('simulator.konvergenceVariabletitle', { variableTitle: variable.title })}>
              <h4>{t('simulator.konvergencePodiluChybnychIntervalu')}<Help topic="convergence" /></h4>
              <p>{t('simulator.chybneIntervalyVsechnyDosavadniPlatneIntervalyOcekavanaHodnota')} {percent(1 - runConfig.confidence, 1)}.</p>
              {#if metric.count}<Plot points={samplingConvergence(history, variable.id)} domain={[1, Math.max(2, runConfig.repeats)]} reference={(1 - runConfig.confidence) * 100} referenceLabel={t('simulator.ocekavanyPodilMimo')} finalValue={(metric.count - metric.covered) / metric.count * 100} finalLabel={t('simulator.skutecnaAlfaNaKonci')} horizontal kind="line" color={current.color} title={t('simulator.konvergenceVariabletitle2', { variableTitle: variable.title })} xLabel={t('simulator.opakovanyVyber')} yLabel={t('simulator.mimo')} currentSample={completed} totalSamples={runConfig.repeats} />{:else}<p class="sampling-no-data">{t('simulator.zatimNeniKDispoziciPlatnyIntervalProVypocet')}</p>{/if}
              {#if status === 'completed' && metric.count}<p class="sampling-note">{t('simulator.konecnyPodilMimo', { missed: number(metric.count - metric.covered), total: number(metric.count), rate: percent((metric.count - metric.covered) / metric.count, 1) })}</p>{/if}
            </section>{/if}
            {#if showForest}<SampleForest {history} variable={variable.id} truth={population[variable.id]} color={current.color} />{/if}
          </article>
        {/each}
      </div>
    </section>
  {/if}
  <ExportPanel {population} config={runConfig} {history} {status} {generating} />
</section>

<style>
  .population-generation{margin-top:14px}.population-generation p{font-size:12px;line-height:1.7;color:#477fa8;margin:8px 0}.population-generation strong{display:block;font-weight:600}.population-generation progress{display:block;width:100%;height:9px;accent-color:#397ec1}.sampling-lab{padding-top:24px;border-top:1px solid var(--line)}.sampling-intro{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:24px}.sampling-intro h2,.sampling-section-title h2{font-size:28px;letter-spacing:-.03em;margin:0 0 12px}.sampling-intro p:not(.eyebrow){font-size:14px;line-height:1.7;color:#607f91;max-width:720px;margin-bottom:0}.synthetic-badge{background:#edf3f8;color:#476d84;padding:12px 16px;white-space:nowrap;font:11px/1.8 'DM Mono',monospace}.sampling-settings{border:0;padding:0;margin:0;min-width:0}.sampling-setup{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sampling-card{background:white;border:1px solid var(--line);padding:24px;min-width:0}.sampling-card h3{font-size:20px;margin:0 0 16px}.sampling-fields,.sampling-demographics{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.sampling-lab label{display:block;font-size:12px;line-height:1.6;color:#4e7085;margin:12px 0}.sampling-lab label input,.sampling-lab label select{display:block;width:100%;border:1px solid #cbdce8;border-radius:4px;background:#fbfdff;color:var(--ink);padding:10px;margin-top:7px;min-width:0}.sampling-lab label input[type=range]{padding:0;accent-color:#397ec1}.sampling-lab label output{float:right;font-family:'DM Mono',monospace}.sampling-note{font-size:12px;line-height:1.8;color:#607f91;margin:14px 0}.sampling-pending{font-size:12px;color:#c34e4e;line-height:1.6}.sampling-card details{margin:20px 0}.sampling-lab summary{cursor:pointer;font-size:14px;font-weight:600;line-height:1.7}.sampling-lab details[open]>summary{margin-bottom:15px}.sampling-inline{display:flex;gap:12px;align-items:center;justify-content:space-between;font-size:12px;margin-top:12px}.population-facts{display:flex;gap:30px;align-items:center;flex-wrap:wrap;padding:22px;background:#e5f0f8;margin:16px 0}.population-facts span{display:block;font-size:11px;color:#58788c;margin-bottom:8px}.population-facts strong{font:19px 'DM Mono',monospace;color:#2f6484}.sampling-error{padding:14px 18px;background:#fff0eb;border:1px solid #e9c5b9;color:#c34e4e;font-size:13px;line-height:1.7}.sampling-run{display:flex;justify-content:space-between;gap:20px;align-items:center;background:#dbeaf5;padding:22px;margin:16px 0 24px}.sampling-run strong{font-size:14px}.sampling-run progress{display:block;width:100%;height:8px;accent-color:#397ec1;margin-top:12px}.sampling-status{display:block;font-size:11px;margin-top:9px;color:#477fa8}.sampling-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:end}.sampling-actions .sampling-forest-toggle{display:flex;align-items:center;gap:6px;margin:0 12px 0 0;font-size:12px}.sampling-actions .sampling-forest-toggle input{display:inline-block;width:17px;height:17px;margin:0;padding:0;accent-color:#397ec1}.sampling-actions .sampling-speed{width:170px;margin:0 12px 0 0;font-size:11px}.sampling-section-title{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-top:32px}.sampling-section-title>span{font:11px 'DM Mono',monospace;color:#607f91}.sampling-outcomes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin:20px 0}.sampling-outcome{background:white;border:1px solid var(--line);padding:22px;min-width:0}.sampling-outcome>h3{font-size:19px;margin:0 0 18px;line-height:1.5}.sampling-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}.sampling-kpi{background:#f4f8fb;border:1px solid #dce8f0;padding:14px;min-width:0}.sampling-kpi.actual{background:#e7f1f7;border-color:#cbdfea}.sampling-kpi>span{display:block;font-size:10px;line-height:1.6;color:#607f91}.sampling-kpi strong{display:block;font:19px/1.5 'DM Mono',monospace;color:#2f6484;margin:8px 0}.sampling-kpi small{font-size:10px;line-height:1.7;color:#607f91;display:block}.sampling-histogram{margin-bottom:26px}.sampling-histogram h4,.sampling-convergence h4{font-size:15px;margin:0 0 10px}.sampling-histogram>p,.sampling-convergence>p{font-size:11px;line-height:1.8;color:#607f91;margin:10px 0}.sampling-convergence .sampling-no-data{height:240px;display:grid;place-items:center;background:#f5f9fc;padding:20px}.sampling-table-scroll{overflow:auto}.sampling-lab table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}.sampling-lab th{font-weight:600}.sampling-lab th,.sampling-lab td{padding:13px 10px;border-bottom:1px solid #dfe9f0;vertical-align:middle;line-height:1.6}.sampling-lab thead th{color:#607f91;font-size:10px;font-weight:500}.sampling-lab tbody th{min-width:165px}.sampling-lab td{white-space:nowrap}.population-details{margin-top:16px}.sampling-methodology p{font-size:13px;line-height:1.8;color:#617b8b}.sampling-lab button:disabled{cursor:default}.sampling-lab fieldset:disabled{opacity:.75}.sampling-lab input:focus-visible,.sampling-lab select:focus-visible,.sampling-lab button:focus-visible,.sampling-lab summary:focus-visible{outline:3px solid #c34e4e;outline-offset:3px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1000px){.population-facts{gap:20px}.sampling-run{display:block}.sampling-actions{justify-content:start;margin-top:18px}}@media(max-width:800px){.sampling-setup,.sampling-outcomes{grid-template-columns:1fr}.sampling-intro,.sampling-section-title{display:block}.synthetic-badge{display:inline-block;margin-top:16px}.population-facts strong{font-size:16px}.sampling-card,.sampling-outcome{padding:18px}.sampling-section-title h2{font-size:24px}.sampling-section-title>span{display:block;margin-bottom:16px}.sampling-kpi strong{font-size:17px}}

  .sampling-setup{align-items:start}.sampling-setup>.sampling-card:nth-of-type(2){grid-column:2;grid-row:1}.population-summary-card{grid-column:1 / -1;grid-row:2;background:#fff;border:1px solid var(--line);padding:22px}.population-summary-card>summary{cursor:pointer;font-size:16px;font-weight:600;color:var(--ink);list-style:none}.population-summary-card>summary::-webkit-details-marker{display:none}.population-summary-card>summary::after{content:'+';float:right;color:#397ec1;font:20px 'DM Mono'}.population-summary-card[open]>summary::after{content:'-'}.population-summary-card .sampling-note{margin-bottom:18px}.population-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.population-category-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px}.population-stat-block{background:#f5f9fc;border:1px solid #dce8f0;padding:14px;min-width:0}.population-stat-block h4{font-size:14px;margin:0 0 12px}.population-stat-block dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}.population-stat-block dl div{min-width:0}.population-stat-block dt{font-size:9px;color:#607f91}.population-stat-block dd{font:13px 'DM Mono';color:#2f6484;margin:4px 0 0}.population-histogram{height:86px;display:flex;align-items:end;gap:2px;margin-top:16px;padding-top:5px;border-bottom:1px solid #b9d3e2}.population-histogram span{display:block;flex:1;min-width:2px;background:#6e9db8;border-radius:2px 2px 0 0}.population-bars{display:grid;gap:8px}.population-bar-row{display:grid;grid-template-columns:minmax(55px,1fr) 1.5fr 42px;gap:7px;align-items:center;font-size:10px}.population-bar-row>div{height:8px;background:#dce8f0;border-radius:10px;overflow:hidden}.population-bar-row i{display:block;height:100%;background:#4d88a8;border-radius:10px}.population-bar-row strong{font:10px 'DM Mono';color:#2f6484;text-align:right}@media(max-width:800px){.sampling-setup>.sampling-card:nth-of-type(2),.population-summary-card{grid-column:auto;grid-row:auto}.population-stat-grid,.population-category-grid{grid-template-columns:1fr}.population-stat-block dl{grid-template-columns:repeat(3,1fr)}}
</style>
