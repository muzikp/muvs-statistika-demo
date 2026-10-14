import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { streamPopulationSheet } from './streaming-xlsx';
import { createPopulation, DEFAULT_SHARES, MAX_POPULATION, validatePopulation } from './sampling';
import { buildExportWorkbook, exportSnapshot } from './sampling-export';

it('accepts a million people and rejects values beyond the Excel-friendly limit', () => {
  expect(validatePopulation({ size: MAX_POPULATION, seed: 'limit', shares: DEFAULT_SHARES })).toEqual([]);
  expect(validatePopulation({ size: MAX_POPULATION + 1, seed: 'limit', shares: DEFAULT_SHARES })).not.toEqual([]);
});

it('streams rows across chunk boundaries, preserving Unicode, numbers, metadata and styles', async () => {
  const population = createPopulation({ size: 10000, seed: '=1+1', shares: DEFAULT_SHARES });
  const template = await buildExportWorkbook('population', { ...exportSnapshot('population', population, null, [], 'idle'), people: [population.people[0]] });
  const progress: number[] = [];
  const buffer = await streamPopulationSheet(new Uint8Array(await template.xlsx.writeBuffer()), 2001,
    index => [index + 1, 35, '30–44', 'Žena & <test>', 'VŠ', '=1+1', 1234, 3, 1], completed => progress.push(completed));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  expect(sheet.rowCount).toBe(2002);
  expect(sheet.getCell('A2002').value).toBe(2001);
  expect(sheet.getCell('D1002').value).toBe('Žena & <test>');
  expect(sheet.getCell('F2').value).toBe('=1+1');
  expect(sheet.getCell('G2002').value).toBe(1234);
  expect(sheet.getCell('A1').font.bold).toBe(true);
  expect(sheet.autoFilter).toBe('A1:I2002');
  expect(workbook.worksheets[1].rowCount).toBe(9);
  expect(workbook.worksheets[2].rowCount).toBeGreaterThan(10);
  expect(progress).toEqual([0, 1000, 2000, 2001]);
});
