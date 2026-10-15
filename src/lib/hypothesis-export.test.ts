import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createHypothesisPopulation, DEFAULT_HYPOTHESIS_SPEC, hypothesisSampler, type HypothesisConfig } from './hypothesis';
import { exportHypothesis } from './hypothesis-export';

it('exports p-values, settings and one long population dataset with a group column', async () => {
  const population = createHypothesisPopulation({ ...DEFAULT_HYPOTHESIS_SPEC, size: 10000, seed: '=1+1' });
  const config: HypothesisConfig = { population: population.summary.spec, nA: 80, nB: 120, repeats: 2, seed: 'export', alpha: .05, alternative: 'greater', nullDifference: 0 };
  const entry = hypothesisSampler(population, config)(0).entry;
  const bytes = await exportHypothesis(population.summary, config, [entry, { iteration: 2, result: null }]);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
  expect(book.worksheets[0].rowCount).toBe(3);
  expect(book.worksheets[0].getCell('L2').value).toBe(entry.result!.p);
  expect(book.worksheets[0].getCell('N2').value).toBe(entry.result!.low);
  expect(book.worksheets[0].getCell('O2').value).toBeNull();
  expect(book.worksheets[0].getCell('Q2').value).toBe(entry.result!.reject);
  expect(book.worksheets[0].getCell('B3').value).toBe(false);
  expect(book.worksheets[0].columnCount).toBe(29);
  expect(book.worksheets[0].getCell('R2').value).toBe(population.summary.groups[0].mean);
  expect(book.worksheets[0].getCell('T2').value).toBe(entry.result!.meanA - population.summary.groups[0].mean);
  expect(book.worksheets[0].getCell('W2').value).toBe(population.summary.cohensD);
  expect(book.worksheets[0].getCell('X2').value).toBe(entry.result!.cohensD);
  expect(book.worksheets[0].getCell('Y2').value).toBe(entry.result!.cohensD! - population.summary.cohensD!);
  expect(book.worksheets[0].getCell('Z2').value).toBe(entry.result!.effectSdA);
  expect(book.worksheets[0].getCell('X3').value).toBeNull();
  expect(book.worksheets[0].getCell('AB2').value).toBe(entry.result!.seA);
  expect(book.worksheets[0].getCell('AC2').value).toBe(entry.result!.seB);
  expect(book.worksheets[0].getCell('L3').value).toBeNull();
  expect(book.worksheets[2].rowCount).toBe(population.summary.spec.size * 2 + 1);
  const seeds = book.worksheets[1].getRows(2, book.worksheets[1].rowCount - 1)!.filter(row => row.getCell(2).value === '=1+1');
  expect(seeds).toHaveLength(1); expect(seeds[0].getCell(2).type).toBe(ExcelJS.ValueType.String);
  expect(book.worksheets[2].getCell('A2').value).toBe('Skupina A');
  expect(book.worksheets[2].getCell('B2').value).toBe(population.summary.dataset!.value[0]);
  expect(book.worksheets[2].getCell('A10002').value).toBe('Skupina B');
  expect(book.worksheets[2].getCell('B10002').value).toBe(population.summary.dataset!.value[population.summary.spec.size]);
  for (const sheet of book.worksheets) {
    expect(JSON.stringify(sheet.getRow(1).values)).not.toMatch(/pohlaví|váhy|věk/i);
  }
});
