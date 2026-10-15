<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/texts';

  import { calculateProbability, operations, type Operation, type Region, type Relation } from '../lib/probability';
  import { number, percent } from '../lib/format';
  import { loadPreferences, savePreferences } from '../lib/preferences';

  let a = $state<number | undefined>(0.5);
  let b = $state<number | undefined>(0.4);
  let intersection = $state<number | undefined>(0.2);
  let relation = $state<Relation>('known');
  let operation = $state<Operation>('union');
  let preferencesLoaded = $state(false);
  const result = $derived(calculateProbability(a ?? NaN, b ?? NaN, intersection ?? NaN, relation, operation));
  const selected = $derived(operations.find(item => item.id === operation)!);
  const conditional = $derived(operation === 'givenB' ? 'B' : operation === 'givenA' ? 'A' : null);
  const exact = $derived(result.range !== null && Math.abs(result.range.high - result.range.low) < 1e-12);
  const decimal = (value: number) => number(value, 4).replace(/,?0+$/, '') || '0';
  const valueText = (value: number) => `${decimal(value)} (${percent(value, 2)})`;
  const regionNames: Record<Region, string> = { onlyA: t('probability.pouzeA'), both: 'A ∩ B', onlyB: t('probability.pouzeB'), neither: t('probability.aniAAniB') };
  const regionOrder: Region[] = ['onlyA', 'both', 'onlyB', 'neither'];
  $effect(() => {
    if (!preferencesLoaded) return;
    savePreferences('probability', { a, b, intersection, relation, operation });
  });
  onMount(() => {
    const saved = loadPreferences<Partial<{ a: number; b: number; intersection: number; relation: Relation; operation: Operation }>>('probability', {});
    if (Number.isFinite(saved.a)) a = saved.a;
    if (Number.isFinite(saved.b)) b = saved.b;
    if (Number.isFinite(saved.intersection)) intersection = saved.intersection;
    if (saved.relation && ['known', 'independent', 'disjoint', 'unknown'].includes(saved.relation)) relation = saved.relation;
    if (saved.operation && operations.some(item => item.id === saved.operation)) operation = saved.operation;
    preferencesLoaded = true;
  });
  const substitution = $derived.by(() => {
    const av = decimal(a ?? NaN), bv = decimal(b ?? NaN), iv = result.intersection === null ? 'P(A ∩ B)' : decimal(result.intersection);
    switch (operation) {
      case 'intersection': return iv;
      case 'union': return `${av} + ${bv} − ${iv}`;
      case 'onlyA': return `${av} − ${iv}`;
      case 'onlyB': return `${bv} − ${iv}`;
      case 'neither': return `1 − ${av} − ${bv} + ${iv}`;
      case 'notA': return `1 − ${av}`;
      case 'notB': return `1 − ${bv}`;
      case 'givenB': return `${iv} / ${bv}`;
      case 'givenA': return `${iv} / ${av}`;
      case 'xor': return `${av} + ${bv} − 2 · ${iv}`;
    }
  });
  function example(kind: 'ordinary' | 'independent' | 'disjoint' | 'unknown') {
    a = .5; b = .4; intersection = .2;
    relation = kind === 'ordinary' ? 'known' : kind;
    operation = 'union';
  }
</script>

<section class="probability-lab" aria-label={t('probability.pravdepodobnostiDvouJevu')}>
  <div class="probability-presets"><span>{t('probability.vyzkousejteZadani')}</span><button onclick={() => example('ordinary')}>{t('probability.znamyPrunik')}</button><button onclick={() => example('independent')}>{t('probability.nezavisleJevy')}</button><button onclick={() => example('disjoint')}>{t('probability.neslucitelneJevy')}</button><button onclick={() => example('unknown')}>{t('probability.neznamyPrunik')}</button></div>
  <div class="probability-layout">
    <section class="probability-inputs">
      <p class="card-kicker">{t('probability.krok01Zadani')}</p>
      <h2>{t('probability.coOJevechVime')}</h2>
      <p class="muted">{t('probability.pravdepodobnostiZadavejteOd0Do1Napriklad0')}</p>
      <div class="probability-fields">
        <label>{t('probability.pA')}<input type="number" min="0" max="1" step="0.01" bind:value={a} /><small>{t('probability.pravdepodobnostJevuA')}</small></label>
        <label>{t('probability.pB')}<input type="number" min="0" max="1" step="0.01" bind:value={b} /><small>{t('probability.pravdepodobnostJevuB')}</small></label>
      </div>
      <label>{t('probability.vztahMeziJevy')}<select bind:value={relation}><option value="known">{t('probability.znamPravdepodobnostPruniku')}</option><option value="independent">{t('probability.jevyJsouNezavisle')}</option><option value="disjoint">{t('probability.jevyJsouNeslucitelne')}</option><option value="unknown">{t('probability.vztahNeznamUrcitMozneMeze')}</option></select></label>
      {#if relation === 'known'}
        <label>{t('probability.pABPAB')}<input type="number" min="0" max="1" step="0.01" bind:value={intersection} /><small>{t('probability.pravdepodobnostZeNastanouObaJevy')}</small></label>
      {:else if relation === 'independent'}
        <p class="probability-hint">{t('probability.nezavislostZnamenaZeNastaniJednohoJevuNemeniPravdepodobnost')}</p>
      {:else if relation === 'disjoint'}
        <p class="probability-hint">{t('probability.neslucitelneJevyNemohouNastatSoucasnePAB')}</p>
      {:else}
        <p class="probability-hint">{t('probability.pAAPBObvykleNeurcujiPrunik')}</p>
      {/if}
      <p class="card-kicker calculation-kicker">{t('probability.krok02Otazka')}</p>
      <label>{t('probability.coChceteVypocitat')}<select bind:value={operation}>{#each operations as item}<option value={item.id}>{item.label}</option>{/each}</select></label>
      <p class="muted">{selected.explanation}</p>
    </section>

    <div class="probability-output">
      {#if result.errors.length}
        <section class="probability-error" role="alert"><h2>{t('probability.zadaniNeniMozne')}</h2>{#each result.errors as error}<p>{error}</p>{/each}
          {#if Number.isFinite(a) && Number.isFinite(b) && a! >= 0 && a! <= 1 && b! >= 0 && b! <= 1}<p>{t('probability.proTytoJevyMusiPlatit')} {decimal(result.min)} {t('probability.pAB')} {decimal(result.max)}.</p>{/if}
          <p>{t('probability.upravteZadaniNeplatnePravdepodobnostiNelzeZnazornit')}</p>
        </section>
      {:else}
        <section class="probability-answer" aria-live="polite" aria-atomic="true">
          <p class="card-kicker">{t('probability.vysledek')} {selected.label}</p>
          {#if result.undefinedConditional}<h2>{t('probability.neniDefinovano')}</h2><p>{t('probability.podminujiciJev')} {conditional} {t('probability.maNulovouPravdepodobnostVeVzorciBychomDeliliNulou')}</p>
          {:else if result.range}<h2>{exact ? percent(result.range.low, 2) : t('probability.resultrangelowAzResultrangehigh', { resultRangeLow: percent(result.range.low, 2), resultRangeHigh: percent(result.range.high, 2) })}</h2><p>{exact ? t('probability.pravdepodobnostJeResultrangelow', { resultRangeLow: decimal(result.range.low) }) : t('probability.zadaneUdajeUrcujiTotoRozmeziProJednoznacnyVysledek')}</p>{/if}
        </section>
        <section class="probability-steps">
          <p class="card-kicker">{t('probability.krok03PostupVypoctu')}</p>
          <h2>{t('probability.odZadaniKVysledku')}</h2>
          <ol>
            <li><strong>{t('probability.overimePripustnyPrunik')}</strong><p>{t('probability.max0PAPB1P')}</p><p class="equation">{decimal(result.min)} {t('probability.pAB')} {decimal(result.max)}</p></li>
            <li><strong>{t('probability.urcimePrunikZeZadani')}</strong>
              {#if relation === 'independent'}<p class="equation">{t('probability.pAB2')} {decimal(a!)} · {decimal(b!)} = {decimal(result.intersection!)}</p>
              {:else if relation === 'disjoint'}<p>{t('probability.jevyJsouNeslucitelneProtoPAB0')}</p>
              {:else if relation === 'known'}<p class="equation">{t('probability.pAB2')} {decimal(result.intersection!)}</p>
              {:else}<p>{t('probability.prunikNeznameVeVypoctuPouzijemeJehoDolniI')}</p>{/if}
            </li>
            <li><strong>{t('probability.pouzijemeVzorec')}</strong><p class="equation">{selected.formula}</p><p>{selected.explanation}</p></li>
            <li><strong>{t('probability.dosadimeAVypocitame')}</strong><p class="equation">{substitution}</p>
              {#if result.undefinedConditional}<p>{t('probability.deleniNulouNeniDefinovano')}</p>
              {:else if result.range}<p class="equation">{exact ? `= ${valueText(result.range.low)}` : t('probability.vysledekResultrangelowResultrangehigh', { resultRangeLow: decimal(result.range.low), resultRangeHigh: decimal(result.range.high) })}</p>{/if}
            </li>
          </ol>
        </section>
      {/if}
    </div>
  </div>
  {#if !result.errors.length}
    <section class="probability-diagram">
      <div class="diagram-heading"><div><p class="card-kicker">{t('probability.jevyVObraze')}</p><h2>{t('probability.vennuvDiagram')}</h2><p>{t('probability.zvyraznenaOblastOdpovidaVybraneOtazcePlochyJsouSchematicke')}</p></div><span class="diagram-key"><i></i>{conditional ? t('probability.prunikCitatelVypoctu') : t('probability.vybranyJev')}</span></div>
      <svg viewBox="0 0 640 310" role="img" aria-labelledby="probability-venn-title probability-venn-desc">
        <title id="probability-venn-title">{selected.label}</title>
        <desc id="probability-venn-desc">{selected.explanation} {conditional ? t('probability.oranzovyObrysOznacujePodminujiciJevConditional', { conditional: conditional }) : ''} {result.regions ? regionOrder.map(region => `${regionNames[region]}: ${percent(result.regions![region], 2)}`).join('; ') : t('probability.ciselnePravdepodobnostiOblastiNelzeBezZnalostiPrunikuUrcit')}</desc>
        <defs>
          <clipPath id="probability-circle-a"><circle cx="260" cy="153" r="108" /></clipPath>
          <mask id="probability-without-b"><rect width="640" height="310" fill="white" /><circle cx="380" cy="153" r="108" fill="black" /></mask>
          <mask id="probability-without-a"><rect width="640" height="310" fill="white" /><circle cx="260" cy="153" r="108" fill="black" /></mask>
          <mask id="probability-outside"><rect width="640" height="310" fill="white" /><circle cx="260" cy="153" r="108" fill="black" /><circle cx="380" cy="153" r="108" fill="black" /></mask>
        </defs>
        <rect x="16" y="15" width="608" height="280" rx="10" fill="#f4f8fb" stroke="#becfba" />
        <rect x="16" y="15" width="608" height="280" rx="10" mask="url(#probability-outside)" fill={selected.regions.includes('neither') ? '#c2dceb' : '#f4f8fb'} />
        <circle cx="260" cy="153" r="108" mask="url(#probability-without-b)" fill={selected.regions.includes('onlyA') ? '#c2dceb' : '#dce8f0'} />
        <circle cx="380" cy="153" r="108" mask="url(#probability-without-a)" fill={selected.regions.includes('onlyB') ? '#c2dceb' : '#dce8f0'} />
        <circle cx="380" cy="153" r="108" clip-path="url(#probability-circle-a)" fill={selected.regions.includes('both') ? '#c2dceb' : '#dce8f0'} />
        <circle cx="260" cy="153" r="108" fill="none" stroke={conditional === 'A' ? '#b56832' : '#48745e'} stroke-width={conditional === 'A' ? 4 : 2} />
        <circle cx="380" cy="153" r="108" fill="none" stroke={conditional === 'B' ? '#b56832' : '#48745e'} stroke-width={conditional === 'B' ? 4 : 2} />
        <text x="35" y="40" class="venn-space">{t('probability.vsechnyVysledky')}</text>
        <text x="205" y="85" class="venn-event">{t('probability.a')}</text><text x="435" y="85" class="venn-event">{t('probability.b')}</text>
        <text x="210" y="151">{t('probability.pouzeA')}</text><text x="320" y="151">{t('probability.aB')}</text><text x="430" y="151">{t('probability.pouzeB')}</text>
        <text x="210" y="176" class="venn-value">{result.regions ? percent(result.regions.onlyA, 1) : '?'}</text><text x="320" y="176" class="venn-value">{result.regions ? percent(result.regions.both, 1) : '?'}</text><text x="430" y="176" class="venn-value">{result.regions ? percent(result.regions.onlyB, 1) : '?'}</text>
        <text x="100" y="255">{t('probability.aniAAniB')}</text><text x="100" y="277" class="venn-value">{result.regions ? percent(result.regions.neither, 1) : '?'}</text>
      </svg>
      {#if conditional}<p class="conditional-note">{t('probability.oranzovyObrysOznacujeJev')} {conditional}{t('probability.naKteryOmezujemeProstorCislaVDiagramuSe')} {conditional}.</p>{/if}
      {#if !result.regions}<p class="conditional-note">{t('probability.otaznikyZnamenajiZeRozdeleniDoCtyrOblastiNeni')}</p>{/if}
      {#if result.regions}<div class="region-summary">{#each regionOrder as region}<div class:region-selected={selected.regions.includes(region)}><span>{regionNames[region]}</span><strong>{valueText(result.regions[region])}</strong></div>{/each}</div>{/if}
    </section>
  {/if}
</section>

<style>
  .probability-lab{border-top:1px solid var(--line);padding-top:22px}h2{font-size:22px;margin:0 0 12px}.probability-presets{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:22px}.probability-presets>span{font-size:12px;margin-right:6px;color:#63746c}.probability-presets button{padding:8px 12px;border:1px solid #c9d8c3;border-radius:20px;background:#edf3e7;color:#315a43;font-size:12px}.probability-presets button:hover{background:#dceccf}.probability-layout{display:grid;grid-template-columns:minmax(270px,.85fr) minmax(0,1.4fr);gap:20px;align-items:start}.probability-inputs,.probability-steps,.probability-diagram{border:1px solid var(--line);background:white;padding:28px}.probability-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.probability-inputs label{display:block;font-size:13px;font-weight:600;margin:18px 0}.probability-inputs input,.probability-inputs select{display:block;width:100%;min-width:0;padding:12px;margin-top:8px;background:#fafcf8;border:1px solid #ccd9c7;border-radius:5px;color:var(--ink)}.probability-inputs small{display:block;font-size:11px;font-weight:400;color:#607f91;line-height:1.5;margin-top:6px}.probability-hint{padding:14px;background:#f0f5e9;font-size:13px;line-height:1.7}.calculation-kicker{border-top:1px solid var(--line);padding-top:25px;margin-top:26px}.probability-output{display:grid;gap:16px}.probability-answer{background:#2f6484;color:#fff;padding:28px}.probability-answer .card-kicker{color:#c4dba8}.probability-answer h2{font:clamp(25px,4vw,38px) 'DM Mono',monospace;margin:14px 0}.probability-answer p:last-child{font-size:13px;line-height:1.7;color:#dbeaf3;margin-bottom:0}.probability-steps ol{padding-left:23px;margin-bottom:0}.probability-steps li{padding-left:8px;margin:20px 0;font-size:13px}.probability-steps li::marker{color:#598045;font-family:'DM Mono',monospace}.probability-steps li p{font-size:13px;line-height:1.7;margin:8px 0;color:#617469}.probability-steps .equation{font:13px/1.8 'DM Mono',monospace;color:#244d3e;overflow-wrap:anywhere}.probability-error{background:#fff0eb;border:1px solid #e9c5b9;padding:28px;color:#9f4535}.probability-error p{line-height:1.7;font-size:14px}.probability-diagram{margin-top:20px}.diagram-heading{display:flex;gap:25px;align-items:center;justify-content:space-between}.diagram-heading p:not(.card-kicker){font-size:13px;color:#617469;line-height:1.7;max-width:650px}.diagram-key{display:flex;align-items:center;gap:8px;font-size:12px;white-space:nowrap}.diagram-key i{width:15px;height:15px;background:#c2dceb;border:1px solid #69974a}.probability-diagram svg{display:block;width:100%;max-width:760px;height:auto;margin:15px auto}.probability-diagram text{text-anchor:middle;font:13px 'DM Sans',sans-serif;fill:#234c3b}.probability-diagram .venn-space{text-anchor:start;font-size:12px}.probability-diagram .venn-event{font-size:22px;font-weight:700}.probability-diagram .venn-value{font:14px 'DM Mono',monospace;font-weight:500}.conditional-note{font-size:13px;line-height:1.7;color:#63746c;max-width:800px;margin:15px auto}.region-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:20px}.region-summary>div{background:#f4f8fb;border:1px solid #dce5da;padding:14px}.region-summary>div.region-selected{background:#e7f1f7;border-color:#a9c88d}.region-summary span{font-size:12px;display:block;margin-bottom:8px}.region-summary strong{font:12px/1.7 'DM Mono',monospace}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #b56832;outline-offset:3px}@media(max-width:800px){.probability-layout{grid-template-columns:1fr}.probability-inputs,.probability-steps,.probability-diagram{padding:20px}.diagram-heading{display:block}.region-summary{grid-template-columns:1fr 1fr}.diagram-key{margin-top:12px}.probability-fields{gap:12px}}
</style>
