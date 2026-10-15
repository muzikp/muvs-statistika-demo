<script lang="ts">
  import { t } from './lib/texts';

  import { onMount } from 'svelte';
  import Simulator from './components/Simulator.svelte';
  import Probability from './components/Probability.svelte';
  import Hypothesis from './components/Hypothesis.svelte';
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const routeUrl = (target: string) => `${base}${target}`;
  const currentPath = () => {
    const pathname = window.location.pathname;
    const relative = base && (pathname === base || pathname.startsWith(`${base}/`))
      ? pathname.slice(base.length) : pathname;
    return relative.replace(/\/$/, '') || '/';
  };
  let path = $state(currentPath());
  const isModule = () => path === '/ci-alfa-explained';
  function navigate(event: MouseEvent, target: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); history.pushState({}, '', routeUrl(target)); path = target; window.scrollTo({ top: 0 });
  }
  onMount(() => {
    const update = () => { path = currentPath(); };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  });
  $effect(() => { document.title = t('app.pageTitle', { pageTitle: isModule() ? t('app.intervalySpolehlivosti') : path === '/hypothesis-testing' ? t('hypothesis.title') : path === '/probability' ? t('app.teoriePravdepodobnosti') : path === '/' ? t('app.statistickaLaborator') : t('app.strankaNenalezena') }); });
</script>

<a class="skip-link" href="#main">{t('app.prejitNaObsah')}</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href={routeUrl('/')} onclick={e => navigate(e, '/')} aria-label={t('app.statistickaLaboratorUvod')}>
      <img class="brand-logo" src={`${base}/evalytics-logo.svg`} alt="Evalytics" />
    </a>
    <nav aria-label={t('app.hlavniNavigace')}><a class:active={path === '/'} href={routeUrl('/')} onclick={e => navigate(e, '/')}>{t('app.prehledTemat')}</a><a class:active={isModule()} href={routeUrl('/ci-alfa-explained')} onclick={e => navigate(e, '/ci-alfa-explained')}>{t('app.intervalySpolehlivosti')}</a><a class:active={path === '/probability'} href={routeUrl('/probability')} onclick={e => navigate(e, '/probability')}>{t('app.pravdepodobnost')}</a><a class:active={path === '/hypothesis-testing'} href={routeUrl('/hypothesis-testing')} onclick={e => navigate(e, '/hypothesis-testing')}>{t('hypothesis.title')}</a></nav>
    <span class="header-note"><span class="status-dot"></span> {t('app.interaktivniVyukaStatistiky')}</span>
  </div>
</header>
<main id="main">
  {#if path === '/'}
    <section class="home-hero page-width">
      <div class="hero-copy"><p class="eyebrow">{t('app.odTeorieKPochopeni')}</p><h1>{t('app.statistikaDavaSmysl')}<br /><em>{t('app.kdyzJiMuzeteZkouset')}</em></h1><p class="lead">{t('app.mistoPoucekVlastniExperimentMenteParametryPozorujteVysledky')}</p><a class="button primary" href={routeUrl('/ci-alfa-explained')} onclick={e => navigate(e, '/ci-alfa-explained')}>{t('app.vyzkousetPrvniExperiment')} <span aria-hidden="true">↗</span></a><div class="hero-footnote">{t('app.bezInstalaceVypoctyPrimoVeVasemProhlizeci')}</div></div>
      <div class="hero-visual" aria-hidden="true">
        <div class="visual-top"><span>{t('app.experiment01')}</span><span class="visual-pill">{t('app.text95Spolehlivost')}</span></div>
        <svg viewBox="0 0 400 250"><line x1="205" x2="205" y1="10" y2="240" stroke="#bdaeb2" stroke-dasharray="4 5" />
          {#each [0,1,2,3,4,5,6,7,8,9] as i}
            {@const start = [100,135,75,150,110,230,120,90,140,105][i]}
            <line x1={start} x2={start+135} y1={22+i*23} y2={22+i*23} stroke={i === 5 ? '#d9838a' : '#9ca9a4'} stroke-width="3" />
            <circle cx={start+67.5} cy={22+i*23} r="5" fill={i === 5 ? '#d9838a' : '#d7dfdb'} />
          {/each}
        </svg><div class="visual-bottom"><span>{t('app.kazdyVyberJinyInterval')}</span><strong>{t('app.stejnaSkutecnost')}</strong></div>
      </div>
    </section>
    <section class="topics-section page-width" aria-labelledby="topics-title">
      <div class="section-heading"><div><p class="eyebrow">{t('app.vaseStatistickeHriste')}</p><h2 id="topics-title">{t('app.vyberteSiTema')}</h2></div><span class="quiet">{t('hypothesis.threeExperiments')}</span></div>
      <div class="topic-grid">
        <a class="topic-card featured" href={routeUrl('/ci-alfa-explained')} onclick={e => navigate(e, '/ci-alfa-explained')}><div class="topic-top"><span class="topic-number">{t('app.text01Odhadovani')}</span><span class="tag">{t('app.dostupne')}</span></div><div class="topic-glyph" aria-hidden="true">{t('app.p')}</div><h3>{t('app.intervalySpolehlivosti')}</h3><p>{t('app.jakVyberLidiOvlivniOdhadPorovnejtePodilApple')}</p><div class="topic-bottom"><span>{t('app.vyberyVazeniIntervaly')}</span><span class="round-arrow" aria-hidden="true">↗</span></div></a>
        <a class="topic-card featured" href={routeUrl('/probability')} onclick={e => navigate(e, '/probability')}><div class="topic-top"><span class="topic-number">{t('app.text02Pravdepodobnost')}</span><span class="tag">{t('app.dostupne')}</span></div><div class="topic-glyph" aria-hidden="true">{t('app.aB')}</div><h3>{t('app.teoriePravdepodobnosti')}</h3><p>{t('app.prunikSjednoceniIPodminenaPravdepodobnostNastavteJevyProjdete')}</p><div class="topic-bottom"><span>{t('app.jevyVypoctyDiagramy')}</span><span class="round-arrow" aria-hidden="true">↗</span></div></a>
        <a class="topic-card featured" href={routeUrl('/hypothesis-testing')} onclick={e => navigate(e, '/hypothesis-testing')}><div class="topic-top"><span class="topic-number">{t('hypothesis.cardNumber')}</span><span class="tag">{t('app.dostupne')}</span></div><div class="topic-glyph" aria-hidden="true">{t('hypothesis.glyph')}</div><h3>{t('hypothesis.title')}</h3><p>{t('hypothesis.cardIntro')}</p><div class="topic-bottom"><span>{t('hypothesis.cardTopics')}</span><span class="round-arrow" aria-hidden="true">&#8599;</span></div></a>
      </div>
    </section>
    <section class="learning-note page-width"><span class="note-symbol" aria-hidden="true">↔</span><div><h3>{t('app.ucteSeTimZeMenitePodminky')}</h3><p>{t('app.neexistujeJedenSpravnyExperimentZkusteMensiVzorekJinou')}</p></div><span class="small-label">{t('app.pozorovatPorozumet')}</span></section>
  {:else if isModule()}
    <div class="page-width module-page"><div class="breadcrumb"><a href={routeUrl('/')} onclick={e => navigate(e, '/')}>{t('app.prehledTemat')}</a><span>/</span><span>{t('app.intervalySpolehlivosti')}</span></div><div class="module-heading"><div><p class="eyebrow">{t('app.experiment01VyberOdhadANejistota')}</p><h1>{t('app.jakBlizkoJeOdhadSkutecnosti')}</h1><p class="lead">{t('app.nestaciZnatVelikostVzorkuZkoumejteVlivVyberuLidi')}</p></div><span class="module-badge">{t('app.odhad')} <span>±</span> {t('app.nejistota')}</span></div><Simulator /></div>
  {:else if path === '/hypothesis-testing'}
    <div class="page-width module-page"><div class="breadcrumb"><a href={routeUrl('/')} onclick={e => navigate(e, '/')}>{t('app.prehledTemat')}</a><span>/</span><span>{t('hypothesis.title')}</span></div><div class="module-heading"><div><p class="eyebrow">{t('hypothesis.experiment')}</p><h1>{t('hypothesis.heading')}</h1><p class="lead">{t('hypothesis.intro')}</p></div><span class="module-badge">{t('hypothesis.glyph')}</span></div><Hypothesis /></div>
  {:else if path === '/probability'}
    <div class="page-width module-page"><div class="breadcrumb"><a href={routeUrl('/')} onclick={e => navigate(e, '/')}>{t('app.prehledTemat')}</a><span>/</span><span>{t('app.teoriePravdepodobnosti')}</span></div><div class="module-heading"><div><p class="eyebrow">{t('app.experiment02PravdepodobnostDvouJevu')}</p><h1>{t('app.kdyzNastaneAACoB')}</h1><p class="lead">{t('app.nastavtePravdepodobnostiVyberteOtazkuASledujteJakSe')}</p></div><span class="module-badge">{t('app.pA')} <span>∩</span> {t('app.b')}</span></div><Probability /></div>
  {:else}
    <section class="page-width empty-page"><p class="eyebrow">404</p><h1>{t('app.tutoStrankuTuNemame')}</h1><a class="button primary" href={routeUrl('/')} onclick={e => navigate(e, '/')}>{t('app.zpetNaPrehledTemat')}</a></section>
  {/if}
</main>
<footer class="site-footer page-width"><span><strong>{t('app.statistickaLaborator')}</strong> {t('app.muvs2')}</span><span>{t('app.experimentujtePtejteSeRozumejte')}</span><span>{t('app.vypoctyZustavajiVProhlizeci')}</span></footer>
