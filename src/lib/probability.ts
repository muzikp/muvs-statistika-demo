import { t } from './texts';
export type Relation = 'known' | 'independent' | 'disjoint' | 'unknown';
export type Operation = 'intersection' | 'union' | 'onlyA' | 'onlyB' | 'neither' | 'notA' | 'notB' | 'givenB' | 'givenA' | 'xor';
export type Region = 'onlyA' | 'both' | 'onlyB' | 'neither';
export const operations: { id: Operation; label: string; formula: string; regions: Region[]; explanation: string }[] = [
  { id: 'intersection', label: t('probabilityRules.prunikPAB'), formula: t('probabilityRules.pAB'), regions: ['both'], explanation: t('probabilityRules.nastanouObaJevySoucasneZapisABZnamena') },
  { id: 'union', label: t('probabilityRules.sjednoceniPAB'), formula: t('probabilityRules.pAPBPAB'), regions: ['onlyA', 'both', 'onlyB'], explanation: t('probabilityRules.nastaneAlesponJedenJevPrunikOdecitameProtozeJsme') },
  { id: 'onlyA', label: t('probabilityRules.aBezBPAB'), formula: t('probabilityRules.pAPAB'), regions: ['onlyA'], explanation: t('probabilityRules.nastaneAASoucasneNenastaneB') },
  { id: 'onlyB', label: t('probabilityRules.bBezAPBA'), formula: t('probabilityRules.pBPAB'), regions: ['onlyB'], explanation: t('probabilityRules.nastaneBASoucasneNenastaneA') },
  { id: 'neither', label: t('probabilityRules.aniAAniB'), formula: t('probabilityRules.text1PAPBPAB'), regions: ['neither'], explanation: t('probabilityRules.nenastaneAniJedenJevJdeODoplnekSjednoceni') },
  { id: 'notA', label: t('probabilityRules.doplnekAPA'), formula: t('probabilityRules.text1PA'), regions: ['onlyB', 'neither'], explanation: t('probabilityRules.jevANenastaneBezOhleduNaB') },
  { id: 'notB', label: t('probabilityRules.doplnekBPB'), formula: t('probabilityRules.text1PB'), regions: ['onlyA', 'neither'], explanation: t('probabilityRules.jevBNenastaneBezOhleduNaA') },
  { id: 'givenB', label: t('probabilityRules.aZaPodminkyBPAB'), formula: t('probabilityRules.pABPB'), regions: ['both'], explanation: t('probabilityRules.vimeZeNastaloBPodilPrunikuPocitamePouze') },
  { id: 'givenA', label: t('probabilityRules.bZaPodminkyAPBA'), formula: t('probabilityRules.pABPA'), regions: ['both'], explanation: t('probabilityRules.vimeZeNastaloAPodilPrunikuPocitamePouze') },
  { id: 'xor', label: t('probabilityRules.praveJedenJevPAB'), formula: t('probabilityRules.pAPB2PAB'), regions: ['onlyA', 'onlyB'], explanation: t('probabilityRules.nastanePraveJedenZJevuAleNeOba') }
];
const clean = (value: number) => Math.max(0, Math.min(1, value));
export function calculateProbability(a: number, b: number, supplied: number, relation: Relation, operation: Operation) {
  const min = Math.max(0, a + b - 1), max = Math.min(a, b);
  const intersection = relation === 'independent' ? a * b : relation === 'disjoint' ? 0 : relation === 'unknown' ? null : supplied;
  const errors: string[] = [];
  if (![a, b].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) errors.push(t('probabilityRules.pAAPBMusiBytCisla'));
  if (!errors.length && intersection !== null && (!Number.isFinite(intersection) || intersection < min - 1e-12 || intersection > max + 1e-12)) {
    errors.push(relation === 'disjoint' ? t('probabilityRules.neslucitelneJevyNemohouMitSoucetPAP') : t('probabilityRules.prunikMusiLezetMeziMax0PA'));
  }
  const evaluate = (i: number) => {
    switch (operation) {
      case 'intersection': return i;
      case 'union': return a + b - i;
      case 'onlyA': return a - i;
      case 'onlyB': return b - i;
      case 'neither': return 1 - a - b + i;
      case 'notA': return 1 - a;
      case 'notB': return 1 - b;
      case 'givenB': return i / b;
      case 'givenA': return i / a;
      case 'xor': return a + b - 2 * i;
    }
  };
  const undefinedConditional = (operation === 'givenB' && b === 0) || (operation === 'givenA' && a === 0);
  const endpoints = intersection === null ? [evaluate(min), evaluate(max)] : [evaluate(intersection)];
  const range = errors.length || undefinedConditional ? null : { low: clean(Math.min(...endpoints)), high: clean(Math.max(...endpoints)) };
  const regions: Record<Region, number> | null = intersection === null || errors.length ? null : { onlyA: clean(a - intersection), both: clean(intersection), onlyB: clean(b - intersection), neither: clean(1 - a - b + intersection) };
  return { errors, min, max, intersection, range, regions, undefinedConditional };
}
