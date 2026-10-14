import { t } from './texts';
import { AGE_GROUPS, SEXES, METHODS } from './sampling';
import type { HypothesisConfig, HypothesisIteration, HypothesisPopulationSummary } from './hypothesis';

export async function exportHypothesis(population: HypothesisPopulationSummary, config: HypothesisConfig, history: HypothesisIteration[], progress?: (completed: number) => void): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook(); book.creator = t('xlsx.statistickaLaboratorMuvs');
  const sheet = book.addWorksheet(t('hypothesis.xlsxResults'), { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = [t('xlsx.vyber'), t('hypothesis.xlsxValid'), t('hypothesis.nA'), t('hypothesis.nB'), t('hypothesis.groupA'), t('hypothesis.groupB'), t('hypothesis.lastDifference'), t('hypothesis.truth'), 'SE', 't', 'df', t('hypothesis.pValue'), 'α', t('hypothesis.xlsxLow'), t('hypothesis.xlsxHigh'), t('hypothesis.xlsxOutside'), t('hypothesis.xlsxReject'), t('hypothesis.xlsxCountsA'), t('hypothesis.xlsxCountsB'), t('hypothesis.xlsxWeightsA'), t('hypothesis.xlsxWeightsB'), t('hypothesis.xlsxMissing')];
  headers.push(t('hypothesis.xlsxPopulationMeanA'), t('hypothesis.xlsxPopulationMeanB'), t('hypothesis.xlsxMeanErrorA'), t('hypothesis.xlsxMeanErrorB'), t('hypothesis.xlsxDifferenceError'), t('hypothesis.populationD'), t('hypothesis.sampleD'), t('hypothesis.xlsxEffectError'), t('hypothesis.xlsxEffectSdA'), t('hypothesis.xlsxEffectSdB'));
  headers.push(t('hypothesis.xlsxSeA'), t('hypothesis.xlsxSeB'));
  sheet.columns = headers.map(header => ({ header, width: 24 }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E574A' } };
  sheet.getRow(1).alignment = { wrapText: true }; sheet.getRow(1).height = 44;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: history.length + 1, column: headers.length } };
  for (let i = 23; i <= headers.length; i++) sheet.getColumn(i).numFmt = '0.000';
  for (let i = 5; i <= 15; i++) sheet.getColumn(i).numFmt = i === 12 || i === 13 ? '0.000000' : '0.000';
  const finite = (value: number | undefined) => value !== undefined && Number.isFinite(value) ? value : null;
  progress?.(0);
  history.forEach((entry, index) => {
    const r = entry.result, sample = entry.sample ?? r;
    sheet.addRow([entry.iteration, !!r, config.nA, config.nB, r?.meanA ?? null, r?.meanB ?? null, r?.difference ?? null, population.truth, r?.se ?? null, r?.statistic ?? null, r?.df ?? null, r?.p ?? null, config.alpha, finite(r?.low), finite(r?.high), r?.outside ?? null, r?.reject ?? null, sample?.counts[0].join('; ') ?? null, sample?.counts[1].join('; ') ?? null, sample?.weights[0].map(weight => weight ?? '').join('; ') ?? null, sample?.weights[1].map(weight => weight ?? '').join('; ') ?? null, entry.insufficient.map(cells => cells.map(h => `${AGE_GROUPS[Math.floor(h / 2)]} ${SEXES[h % 2]}`).join('; ')).join(' / '), population.groups[0].mean, population.groups[1].mean, r ? r.meanA - population.groups[0].mean : null, r ? r.meanB - population.groups[1].mean : null, r ? r.difference - population.truth : null, population.cohensD, r?.cohensD ?? null, r && r.cohensD !== null && population.cohensD !== null ? r.cohensD - population.cohensD : null, r?.effectSdA ?? null, r?.effectSdB ?? null, r?.seA ?? null, r?.seB ?? null]);
    if ((index + 1) % 1000 === 0 || index === history.length - 1) progress?.(index + 1);
  });
  const meta = book.addWorksheet(t('hypothesis.xlsxSettings'));
  meta.columns = [{ header: t('xlsx.polozka'), width: 45 }, { header: t('hypothesis.xlsxValue'), width: 110 }];
  const rows: (string | number)[][] = [
    [t('xlsx.data'), t('hypothesis.populationNote')], [t('xlsx.casExportuUtc'), new Date().toISOString()],
    [t('hypothesis.size'), population.spec.size], [t('simulator.seedPopulace'), population.spec.seed],
    [t('hypothesis.meanA'), population.groups[0].mean], [t('hypothesis.groupB'), population.groups[1].mean], [t('hypothesis.truth'), population.truth],
    [t('hypothesis.spreadA'), population.spec.spreadA], [t('hypothesis.spreadB'), population.spec.spreadB],
    [t('hypothesis.actualSdA'), population.groups[0].sd], [t('hypothesis.actualSdB'), population.groups[1].sd],
    [t('hypothesis.populationD'), population.cohensD ?? t('simulator.nelzeOdhadnout')], [t('hypothesis.cohensD'), t('hypothesis.effectNote')],
    [t('simulator.metodaVyberu'), METHODS.find(method => method.id === config.method)!.name], [t('hypothesis.nA'), config.nA], [t('hypothesis.nB'), config.nB],
    [t('simulator.pocetOpakovani'), config.repeats], [t('xlsx.exportovaneDokonceneVybery'), history.length], [t('simulator.seedVyberu'), config.seed],
    [t('hypothesis.alpha'), config.alpha * 100], [t('hypothesis.nullDifference'), config.nullDifference],
    [t('hypothesis.alternative'), config.alternative === 'two-sided' ? t('hypothesis.twoSided') : config.alternative === 'greater' ? t('hypothesis.greater') : t('hypothesis.less')],
    [t('simulator.demografickeZkresleniPrilezitostnehoSberu'), config.demographicBias], [t('hypothesis.outcomeBias'), config.outcomeBias],
    [t('hypothesis.composition'), population.spec.shares.join('; ')],
    [t('hypothesis.methodology'), t('hypothesis.methodologyText')], [t('hypothesis.interval', { confidence: (1 - config.alpha) * 100 }), t('hypothesis.xlsxBoundsNote')],
    [t('hypothesis.xlsxCountsA'), t('hypothesis.xlsxOrder', { groups: population.counts.map((_, h) => `${AGE_GROUPS[Math.floor(h / 2)]} ${SEXES[h % 2]}`).join('; ') })]
  ];
  rows.forEach(row => meta.addRow(row)); meta.getColumn(2).alignment = { wrapText: true };
  const targets = book.addWorksheet(t('xlsx.cilePopulace'));
  targets.columns = [t('xlsx.vekovaSkupina'), t('xlsx.pohlavi'), t('xlsx.pocetVPopulaciN'), t('xlsx.populacniPodilW')].map(header => ({ header, width: 24 }));
  population.counts.forEach((count, h) => targets.addRow([AGE_GROUPS[Math.floor(h / 2)], SEXES[h % 2], count, count / population.spec.size])); targets.getColumn(4).numFmt = '0.00%';
  const bytes = await book.xlsx.writeBuffer(), buffer = new Uint8Array(bytes.byteLength); buffer.set(new Uint8Array(bytes)); return buffer.buffer;
}
