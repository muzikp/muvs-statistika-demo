import { mount } from 'svelte';
import App from './App.svelte';
import './style.css';
import './help.css';
import './forest.css';
import './overrides.css';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import './tippy-overrides.css';

mount(App, { target: document.getElementById('app')! });

function helpText(label: string) {
  const value = label.toLowerCase();
  if (value.includes('velikost vzorku')) return 'Kolik jednotek vybereme v jednom n\u00e1hodn\u00e9m v\u00fdb\u011bru. V\u011bt\u0161\u00ed vzorek obvykle zp\u0159esn\u00ed jednotliv\u00fd odhad a z\u00fa\u017e\u00ed interval.';
  if (value.includes('opakov\u00e1n\u00ed')) return 'Kolikr\u00e1t n\u00e1hodn\u00fd v\u00fdb\u011br zopakujeme. V\u00edce opakov\u00e1n\u00ed uk\u00e1\u017ee stabiln\u011bji, jak \u010dasto intervaly pokryj\u00ed skute\u010dnou hodnotu.';
  if (value.includes('spolehlivost')) return 'Dlouhodob\u00e9 pokryt\u00ed interval\u016f. P\u0159i 95 % o\u010dek\u00e1v\u00e1me, \u017ee p\u0159ibli\u017en\u011b 5 % interval\u016f skute\u010dnou hodnotu nezachyt\u00ed.';
  if (value.includes('populace')) return 'Kolik jednotek obsahuje cel\u00e1 zn\u00e1m\u00e1 populace, se kterou budeme odhady porovn\u00e1vat.';
  if (value.includes('rozlo\u017een\u00ed')) return 'Ur\u010duje pravidlo, podle kter\u00e9ho se vygeneruj\u00ed hodnoty v populaci. Volba m\u011bn\u00ed tvar populace, ne princip v\u00fdb\u011bru.';
  if (value.includes('seed')) return 'Seed ur\u010duje n\u00e1hodnou posloupnost. Stejn\u00fd seed a stejn\u00e9 nastaven\u00ed vytvo\u0159\u00ed stejn\u00fd v\u00fdsledek.';
  if (value.includes('v\u00fdb\u011bry')) return 'Kolik jednotliv\u00fdch n\u00e1hodn\u00fdch v\u00fdb\u011br\u016f u\u017e simulace zpracovala.';
  if (value.includes('intervaly mimo')) return 'Kolik interval\u016f dosud neobsahovalo skute\u010dnou popula\u010dn\u00ed hodnotu.';
  if (value.includes('pod\u00edl mimo')) return 'Pod\u00edl chybn\u00fdch interval\u016f mezi v\u0161emi dokon\u010den\u00fdmi v\u00fdb\u011bry. P\u0159i spolehlivosti 95 % se dlouhodob\u011b bl\u00ed\u017e\u00ed 5 %.';
  if (value.includes('skute\u010dn\u00e1 hodnota')) return 'Hodnota zn\u00e1m\u00e1 z cel\u00e9 v\u00fdukov\u00e9 populace. S n\u00ed porovn\u00e1v\u00e1me odhady z n\u00e1hodn\u00fdch v\u00fdb\u011br\u016f.';
  if (value.includes('v\u00fdb\u011brov\u00fd pr\u016fm\u011br')) return 'Pln\u00e1 k\u0159ivka je empirick\u00e9 rozlo\u017een\u00ed v\u00fdb\u011brov\u00fdch pr\u016fm\u011br\u016f. P\u0159eru\u0161ovan\u00e1 k\u0159ivka ukazuje norm\u00e1ln\u00ed aproximaci podle centr\u00e1ln\u00ed limitn\u00ed v\u011bty.';
  if (value.includes('rozd\u011blen\u00ed odhad\u016f')) return 'Ka\u017ed\u00fd sloupec ukazuje, kolikr\u00e1t vznikl bodov\u00fd odhad v dan\u00e9m intervalu \u0161irok\u00e9m 1 procentn\u00ed bod.';
  if (value.includes('konvergence')) return 'Graf sleduje, jak se pod\u00edl chybn\u00fdch interval\u016f s p\u0159ib\u00fdvaj\u00edc\u00edmi v\u00fdb\u011bry ustaluje kolem o\u010dek\u00e1van\u00e9 hodnoty alfa.';
  if (value.includes('pr\u016fm\u011brn\u00fd interval')) return 'Zv\u00fdrazn\u011bn\u00fd interval je pr\u016fm\u011br doln\u00edch a horn\u00edch mez\u00ed v\u0161ech dosud vytvo\u0159en\u00fdch interval\u016f. Nen\u00ed to nov\u00fd interval spolehlivosti.';
  if (value.includes('kategorie')) return 'Vyberte kategorii, jej\u00ed\u017e odhady chcete v grafech sledovat.';
  if (value.includes('intervalov\u00fd les')) return 'Zobraz\u00ed pr\u016fm\u011br doln\u00edch a horn\u00edch mez\u00ed v\u0161ech dosud vytvo\u0159en\u00fdch interval\u016f.';
  if (value.includes('rychlost')) return 'Ur\u010duje prodlevu mezi jednotliv\u00fdmi v\u00fdb\u011bry b\u011bhem animace. Hodnota 0 zobraz\u00ed simulaci bez \u010dek\u00e1n\u00ed.';
  if (value.includes('graf')) return 'Graf ukazuje, co se p\u0159i opakovan\u00fdch n\u00e1hodn\u00fdch v\u00fdb\u011brech m\u011bn\u00ed a k jak\u00e9 popula\u010dn\u00ed hodnot\u011b se odhady vztahuj\u00ed.';
  return 'Tato n\u00e1pov\u011bda vysv\u011btluje, jak prvek ovliv\u0148uje simulaci nebo jak \u010d\u00edst zobrazen\u00fd v\u00fdsledek.';
}

function installTooltips() {
  document.querySelectorAll<HTMLElement>('.setup-card label, .result-controls label, .forest-head label, .kpi, .chart-card h3, .card-kicker').forEach((element) => {
    if (element.querySelector('.real-help')) return;
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'real-help'; trigger.textContent = '?';
    trigger.setAttribute('aria-label', 'Zobrazit nápovědu');
    const text = element instanceof HTMLLabelElement ? helpText(element.textContent || '') : helpText(element.textContent || 'graf');
    const control = element.querySelector('input, select');
    if (control) element.insertBefore(trigger, control);
    else element.appendChild(trigger);
    tippy(trigger, { content: text, placement: 'top', maxWidth: 280, interactive: true, appendTo: () => document.body });
  });
}
const observer = new MutationObserver(installTooltips);
observer.observe(document.getElementById('app')!, { childList: true, subtree: true });
installTooltips();
