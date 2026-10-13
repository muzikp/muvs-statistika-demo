<script lang="ts">
  import { onMount } from 'svelte';
  import Simulator from './components/Simulator.svelte';
  import CategoryControls from './components/CategoryControls.svelte';
  import IntervalForestPanel from './components/IntervalForestPanel.svelte';
  let path = $state(window.location.pathname.replace(/\/$/, '') || '/');
  const isModule = () => path === '/ci-alfa-explained';
  function navigate(event: MouseEvent, target: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); history.pushState({}, '', target); path = target; window.scrollTo({ top: 0 });
  }
  onMount(() => {
    const update = () => { path = window.location.pathname.replace(/\/$/, '') || '/'; };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  });
  $effect(() => { document.title = `${isModule() ? 'Intervaly spolehlivosti' : path === '/' ? 'Statistická laboratoř' : 'Stránka nenalezena'} · MÚVS`; });
</script>

<a class="skip-link" href="#main">Přejít na obsah</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="/" onclick={e => navigate(e, '/')} aria-label="Statistická laboratoř – úvod">
      <span class="brand-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span>Statistická<span class="brand-sub">laboratoř <b>MÚVS</b></span></span>
    </a>
    <nav aria-label="Hlavní navigace"><a class:active={path === '/'} href="/" onclick={e => navigate(e, '/')}>Přehled témat</a><a class:active={isModule()} href="/ci-alfa-explained" onclick={e => navigate(e, '/ci-alfa-explained')}>Intervaly spolehlivosti</a></nav>
    <span class="header-note"><span class="status-dot"></span> Interaktivní výuka statistiky</span>
  </div>
</header>
<main id="main">
  {#if path === '/'}
    <section class="home-hero page-width">
      <div class="hero-copy"><p class="eyebrow">OD TEORIE K POCHOPENÍ</p><h1>Statistika dává smysl.<br /><em>Když ji můžete zkoušet.</em></h1><p class="lead">Místo pouček vlastní experiment. Měňte parametry, pozorujte výsledky a objevujte, co se za čísly skutečně skrývá.</p><a class="button primary" href="/ci-alfa-explained" onclick={e => navigate(e, '/ci-alfa-explained')}>Vyzkoušet první experiment <span aria-hidden="true">↗</span></a><div class="hero-footnote">Bez instalace. Výpočty přímo ve vašem prohlížeči.</div></div>
      <div class="hero-visual" aria-hidden="true">
        <div class="visual-top"><span>EXPERIMENT 01</span><span class="visual-pill">95% spolehlivost</span></div>
        <svg viewBox="0 0 400 250"><line x1="205" x2="205" y1="10" y2="240" stroke="#c4dba8" stroke-dasharray="4 5" />
          {#each [0,1,2,3,4,5,6,7,8,9] as i}
            {@const start = [100,135,75,150,110,230,120,90,140,105][i]}
            <line x1={start} x2={start+135} y1={22+i*23} y2={22+i*23} stroke={i === 5 ? '#f2b08b' : '#a3c8b7'} stroke-width="3" />
            <circle cx={start+67.5} cy={22+i*23} r="5" fill={i === 5 ? '#f2b08b' : '#d8e9dc'} />
          {/each}
        </svg><div class="visual-bottom"><span>Každý výběr, jiný interval.</span><strong>Stejná skutečnost.</strong></div>
      </div>
    </section>
    <section class="topics-section page-width" aria-labelledby="topics-title">
      <div class="section-heading"><div><p class="eyebrow">VAŠE STATISTICKÉ HŘIŠTĚ</p><h2 id="topics-title">Vyberte si téma</h2></div><span class="quiet">01 dostupný experiment</span></div>
      <div class="topic-grid">
        <a class="topic-card featured" href="/ci-alfa-explained" onclick={e => navigate(e, '/ci-alfa-explained')}><div class="topic-top"><span class="topic-number">01 / ODHADOVÁNÍ</span><span class="tag">Dostupné</span></div><div class="topic-glyph" aria-hidden="true">[ p̂ ± ? ]</div><h3>Intervaly spolehlivosti</h3><p>Co doopravdy znamená 95 %? Losujte vzorky a sledujte, jak často interval zachytí skutečný podíl.</p><div class="topic-bottom"><span>Simulace · podíly · α</span><span class="round-arrow" aria-hidden="true">↗</span></div></a>
        <article class="topic-card planned"><div class="topic-top"><span class="topic-number">02 / ROZDĚLENÍ</span><span class="tag muted">Připravujeme</span></div><div class="topic-glyph" aria-hidden="true">∿</div><h3>Náhodné veličiny</h3><p>Prostor pro budoucí experimenty s rozděleními, jejich parametry a pravděpodobností.</p><div class="topic-bottom"><span>Další téma laboratoře</span><span aria-hidden="true">＋</span></div></article>
        <article class="topic-card planned"><div class="topic-top"><span class="topic-number">03 / SOUVISLOSTI</span><span class="tag muted">Připravujeme</span></div><div class="topic-glyph" aria-hidden="true">↗</div><h3>Korelace a regrese</h3><p>Prostor pro budoucí zkoumání vztahů mezi proměnnými a interpretace regresních modelů.</p><div class="topic-bottom"><span>Další téma laboratoře</span><span aria-hidden="true">＋</span></div></article>
      </div>
    </section>
    <section class="learning-note page-width"><span class="note-symbol" aria-hidden="true">↔</span><div><h3>Učte se tím, že měníte podmínky.</h3><p>Neexistuje jeden správný experiment. Zkuste menší vzorek, jinou spolehlivost nebo nové složení populace a porovnejte výsledky.</p></div><span class="small-label">POZOROVAT → POROZUMĚT</span></section>
  {:else if isModule()}
    <div class="page-width module-page"><div class="breadcrumb"><a href="/" onclick={e => navigate(e, '/')}>Přehled témat</a><span>/</span><span>Intervaly spolehlivosti</span></div><div class="module-heading"><div><p class="eyebrow">EXPERIMENT 01 · ODHADOVÁNÍ POPULAČNÍHO PODÍLU</p><h1>Co znamená 95% spolehlivost?</h1><p class="lead">Jeden interval neřekne celý příběh. Vylosujte tisíce vzorků a podívejte se na něj z odstupu.</p></div><span class="module-badge">p̂ <span>±</span> z · SE</span></div><Simulator /></div>
  {:else}
    <section class="page-width empty-page"><p class="eyebrow">404</p><h1>Tuto stránku tu nemáme.</h1><a class="button primary" href="/" onclick={e => navigate(e, '/')}>Zpět na přehled témat</a></section>
  {/if}
</main>
{#if isModule()}<CategoryControls />{/if}
{#if isModule()}<div class="page-width forest-host"><IntervalForestPanel /></div>{/if}
<footer class="site-footer page-width"><span><strong>Statistická laboratoř</strong> · MÚVS</span><span>Experimentujte. Ptejte se. Rozumějte.</span><span>Výpočty zůstávají v prohlížeči.</span></footer>
