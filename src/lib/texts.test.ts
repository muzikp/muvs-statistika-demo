import { describe, expect, it } from 'vitest';
import { dictionary, formatText, t } from './texts';

describe('JSON slovník textů', () => {
  it('načítá text přímo ze slovníku a dosazuje pojmenované hodnoty', () => {
    expect(t('app.prejitNaObsah')).toBe(dictionary.app.prejitNaObsah);
    expect(t('simulator.progress', { completed: 0, total: 200 })).toBe('0 / 200 výběrů');
    expect(t('app.pageTitle', { pageTitle: 'Ukázka' })).toBe('Ukázka · MÚVS');
  });
  it('zachovává nulu, nevyhodnocuje HTML a nahrazuje opakované proměnné', () => {
    expect(formatText('{count} / {count}; {flag}', { count: 0, flag: false })).toBe('0 / 0; false');
    expect(formatText('{text}', { text: '<script>alert(1)</script>' })).toBe('<script>alert(1)</script>');
    expect(formatText('Text {missing}')).toBe('Text {missing}');
  });
  it('dlouhé nápovědy a modelové popisky pocházejí ze stejného slovníku', () => {
    expect(dictionary.help.sampleSize.paragraphs.length).toBeGreaterThan(1);
    expect(dictionary.populationLabels.ageGroups).toHaveLength(4);
    expect(dictionary.populationLabels.sexes).toHaveLength(2);
    expect(dictionary.populationLabels.education).toHaveLength(3);
    expect(dictionary.populationLabels.phones).toHaveLength(4);
  });
});
