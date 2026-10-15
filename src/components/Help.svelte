<script lang="ts">
  import { t } from '../lib/texts';

  import tippy, { hideAll, type Instance } from 'tippy.js';
  import { SAMPLING_HELP, type SamplingHelpTopic } from '../lib/sampling-help';
  let { topic }: { topic: SamplingHelpTopic } = $props();

  function tooltip(node: HTMLButtonElement, initialTopic: SamplingHelpTopic) {
    let instance: Instance;
    function close() { node.focus({ preventScroll: true }); instance.hide(); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); close(); } }
    function enterContent(event: KeyboardEvent) {
      if (event.key === 'ArrowDown' && instance.state.isVisible) { event.preventDefault(); instance.popper.querySelector<HTMLButtonElement>('.learning-help-close')?.focus(); }
    }
    function content(key: SamplingHelpTopic) {
      const entry = SAMPLING_HELP[key], container = document.createElement('div');
      container.className = 'learning-help-content';
      const heading = document.createElement('strong'); heading.className = 'learning-help-title'; heading.textContent = entry.title;
      const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'learning-help-close'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label', t('tooltip.zavritNapovedu')); closeButton.addEventListener('click', close);
      container.append(heading, closeButton);
      for (const paragraph of entry.paragraphs) { const p = document.createElement('p'); p.textContent = paragraph; container.append(p); }
      return container;
    }
    instance = tippy(node, {
      content: content(initialTopic), theme: 'learning', placement: 'top', maxWidth: 440,
      interactive: true, appendTo: () => document.body, trigger: 'mouseenter focus click',
      touch: true, hideOnClick: true, delay: [150, 100],
      popperOptions: { modifiers: [{ name: 'preventOverflow', options: { padding: 12, altAxis: true, tether: false } }, { name: 'flip', options: { padding: 12 } }] },
      aria: { content: 'describedby', expanded: true },
      onShow(current) { hideAll({ exclude: current }); document.addEventListener('keydown', escape); },
      onHide() { document.removeEventListener('keydown', escape); }
    });
    node.addEventListener('keydown', enterContent);
    return { update(key: SamplingHelpTopic) { instance.setContent(content(key)); }, destroy() { document.removeEventListener('keydown', escape); node.removeEventListener('keydown', enterContent); instance.destroy(); } };
  }
</script>

<button type="button" class="help-button" data-help={topic} aria-label={t('tooltip.napovedaSamplinghelptopictitle', { SAMPLINGHELPTopicTitle: SAMPLING_HELP[topic].title })} use:tooltip={topic} onclick={event => { event.preventDefault(); event.stopPropagation(); }}>?</button>

<style>
  .help-button{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle;width:20px;height:20px;min-width:20px;margin:0 0 0 7px;padding:0;border:1px solid #91b7cf;border-radius:50%;background:#f9fcf5;color:#397ec1;font:12px/1 'DM Sans',sans-serif;cursor:help;letter-spacing:0}.help-button:hover{background:#e8f1f7;border-color:#2d66a0}.help-button:focus-visible{outline:3px solid #c34e4e;outline-offset:3px}@media(pointer:coarse){.help-button{width:28px;height:28px;min-width:28px;font-size:14px}}
</style>
