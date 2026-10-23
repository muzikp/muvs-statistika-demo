<script lang="ts">
  import { t } from '../lib/texts';
  import { PHONES, type Population } from '../lib/sampling';
  import { number } from '../lib/format';

  let { population }: { population: Population } = $props();
  let selectedId = $state(0);
  let previousId = $state(0);
  let transitionId = $state<number | null>(null);
  let transitionTimer: ReturnType<typeof setTimeout> | undefined;
  const width = 620, height = 330, center = { x: width / 2, y: 155 }, contactRadius = 12;
  const selected = $derived(population.people[selectedId]);
  const gender = (sex: number) => sex === 0 ? '♀' : '♂';
  const phone = (id: number) => PHONES[id] ?? '—';
  const person = (id: number) => population.people[id];

  const links = $derived.by(() => {
    const graph = population.network;
    if (!graph || !selected) return [];
    const start = graph.offsets[selectedId], end = graph.offsets[selectedId + 1], count = end - start;
    return Array.from({ length: count }, (_, index) => {
      const id = graph.neighbors[start + index];
      // Three collision-safe rings keep bubble centres well apart while the jitter
      // makes the network feel organic rather than like a clock face.
      const ringSize = Math.ceil(count / 3);
      const ring = Math.min(2, Math.floor(index / Math.max(1, ringSize)));
      const inRing = index - ring * ringSize;
      const ringCount = Math.min(ringSize, count - ring * ringSize);
      const jitter = (((id * 17 + index * 29) % 100) / 100 - 0.5) * 0.16;
      const angle = -Math.PI / 2 + (inRing / Math.max(1, ringCount)) * Math.PI * 2 + ring * 0.37 + jitter;
      const distance = 68 + ring * 32 + (((id * 31 + index * 13) % 100) / 100 - 0.5) * 8;
      return { id, x: center.x + distance * Math.cos(angle), y: center.y + distance * Math.sin(angle) };
    });
  });

  const contactLinks = $derived.by(() => {
    const graph = population.network;
    if (!graph || links.length < 2) return [];
    const connected = (a: number, b: number) => {
      const start = graph.offsets[a], end = graph.offsets[a + 1];
      for (let i = start; i < end; i += 1) if (graph.neighbors[i] === b) return true;
      return false;
    };
    const edges: Array<{ a: number; b: number; ax: number; ay: number; bx: number; by: number }> = [];
    for (let i = 0; i < links.length; i += 1) {
      for (let j = i + 1; j < links.length; j += 1) {
        if (connected(links[i].id, links[j].id) || connected(links[j].id, links[i].id)) {
          edges.push({ a: links[i].id, b: links[j].id, ax: links[i].x, ay: links[i].y, bx: links[j].x, by: links[j].y });
        }
      }
    }
    return edges;
  });

  function choose(id: number) {
    if (id === selectedId || transitionId !== null) return;
    if (transitionTimer) clearTimeout(transitionTimer);
    previousId = selectedId;
    transitionId = id;
    transitionTimer = setTimeout(() => { selectedId = id; transitionId = null; transitionTimer = undefined; }, 420);
  }
  function randomPerson() { if (population.people.length > 1) choose(Math.floor(Math.random() * population.people.length)); }
</script>

<section class="network-viewer" aria-label={t('simulator.socialniSit')}>
  <div class="network-heading"><div><h4>{t('simulator.socialniSit')}<span class="network-count">{number(links.length)} {t('simulator.kontaktu')}</span></h4><p>{t('simulator.socialniSitPopis')}</p></div><button type="button" class="button ghost" onclick={randomPerson}>{t('simulator.jinyClovek')}</button></div>
  {#if population.network}
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('simulator.socialniSit')}>
      {#each links as link}
        {@const moving = link.id === transitionId}
        <line class:recent={link.id === previousId} x1={center.x} y1={center.y} x2={moving ? center.x : link.x} y2={moving ? center.y : link.y} />
      {/each}
      {#each contactLinks as edge}
        {@const movingA = edge.a === transitionId}
        {@const movingB = edge.b === transitionId}
        <line class="contact-link" x1={movingA ? center.x : edge.ax} y1={movingA ? center.y : edge.ay} x2={movingB ? center.x : edge.bx} y2={movingB ? center.y : edge.by} />
      {/each}
      {#key selectedId}
        {#each links as link}
          {@const p = person(link.id)}
          <g class="contact" class:selected-contact={link.id === previousId} class:moving={link.id === transitionId} style={`transform:translate(${link.id === transitionId ? center.x : link.x}px,${link.id === transitionId ? center.y : link.y}px) scale(${link.id === transitionId ? 1.9 : 1})`} role="button" tabindex="0" aria-label={`${gender(p.sex)} ${p.age} ${phone(p.phone)}`} onclick={() => choose(link.id)} onkeydown={(event) => (event.key === 'Enter' || event.key === ' ') && choose(link.id)}>
            <circle cx="0" cy="0" r={contactRadius}><title>{gender(p.sex)} · {p.age} {t('simulator.vekLet')} · {phone(p.phone)}</title></circle>
            <text class="contact-gender" x="0" y="-2" text-anchor="middle">{gender(p.sex)}</text><text class="contact-age" x="0" y="5" text-anchor="middle">{p.age}</text><text class="phone-label" x="0" y="10" text-anchor="middle">{phone(p.phone)}</text>
          </g>
        {/each}
      {/key}
      {#if selected}<g class="ego" class:fading={transitionId !== null}><circle cx={center.x} cy={center.y} r="23" /><text class="ego-gender" x={center.x} y={center.y - 3} text-anchor="middle">{gender(selected.sex)}</text><text class="ego-age" x={center.x} y={center.y + 5} text-anchor="middle">{selected.age}</text><text class="ego-phone" x={center.x} y={center.y + 12} text-anchor="middle">{phone(selected.phone)}</text></g>{/if}
    </svg>
    <div class="network-detail"><strong>{t('simulator.osoba')} {selected.id}</strong><span>{gender(selected.sex)} {selected.age} {t('simulator.vekLet')} · {phone(selected.phone)}</span><span>{t('simulator.kontaktu')}: {number(population.network.offsets[selectedId + 1] - population.network.offsets[selectedId])}</span></div>
  {:else}<p class="sampling-note">{t('simulator.socialniSitNeniPripravena')}</p>{/if}
</section>

<style>
  .network-viewer{margin-top:16px;padding:18px;background:#f5f9fc;border:1px solid #dce8f0}.network-heading{display:flex;justify-content:space-between;align-items:start;gap:16px}.network-heading h4{margin:0;font-size:15px}.network-heading p{margin:7px 0 0;font-size:11px;line-height:1.7;color:#607f91}.network-count{margin-left:10px;color:#607f91;font:10px 'DM Mono',monospace}.network-heading .button{margin:0;padding:7px 10px;font-size:11px;white-space:nowrap}.network-viewer svg{display:block;width:100%;height:auto;margin-top:10px;background:white;border:1px solid #dce8f0;overflow:visible}.network-viewer line{stroke:#b9d3e2;stroke-width:1.2;transition:stroke .3s,stroke-width .3s,x2 .42s ease,y2 .42s ease}.network-viewer line.contact-link{stroke:#8fc4e5;stroke-width:1;opacity:.5}.network-viewer line.recent{stroke:#c34e4e;stroke-width:2}.contact{cursor:pointer;outline:none;transition:transform .42s ease,opacity .32s ease;animation:contact-in .38s ease both}.contact circle{fill:#dbeaf5;stroke:#397ec1;stroke-width:1.2;transition:fill .3s,stroke .3s}.contact.moving circle{fill:#c34e4e;stroke:#162f40;stroke-width:1.8}.contact:hover circle,.contact:focus circle,.contact.selected-contact circle{fill:#b9d3e2;stroke:#c34e4e}.contact text,.ego text{font-family:'DM Mono',monospace;pointer-events:none}.contact-gender{font-size:11px;fill:#162f40;font-weight:700}.contact-age{font-size:6px;fill:#162f40;font-weight:600}.phone-label{font-size:4px;fill:#162f40}.ego{transition:opacity .42s ease}.ego.fading circle{animation:ego-shrink .42s ease forwards}.ego.fading text{animation:ego-text-out .42s ease forwards}.ego circle{fill:#c34e4e;stroke:#162f40;stroke-width:2}.ego-gender{font-size:16px;fill:white;font-weight:700}.ego-age{font-size:8px;fill:white;font-weight:600}.ego-phone{font-size:5px;fill:white}.network-detail{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#607f91}.network-detail strong{color:#162f40}.network-detail span{font-family:'DM Mono',monospace}@keyframes contact-in{from{opacity:0}to{opacity:1}}@keyframes ego-shrink{from{transform:scale(1);transform-origin:310px 155px}to{transform:scale(.05);transform-origin:310px 155px}}@keyframes ego-text-out{from{opacity:1}to{opacity:0}}@media(max-width:650px){.network-heading{display:block}.network-heading .button{margin-top:10px}.network-viewer{padding:12px}}
</style>
