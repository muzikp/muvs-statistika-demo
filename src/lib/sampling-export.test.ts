import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { createPopulation, DEFAULT_SHARES, simulateOnce, convenienceCDF, stratifiedAllocation, type SamplingConfig, type SamplingIteration } from './sampling';
import { buildExportWorkbook, exportSnapshot, serializeExport } from './sampling-export';

const population = createPopulation({ size: 10000, seed: '=1+1', shares: DEFAULT_SHARES });
const config: SamplingConfig = { population: population.spec, method: 'weighted', n: 400, repeats: 100, seed: 'export', confidence: .95, demographicBias: 1, outcomeBias: 0 };
const result = simulateOnce(population, config, 0, convenienceCDF(population, 1, 0), stratifiedAllocation(population.cells.map(c => c.length), config.n));
const history: SamplingIteration[] = [{ iteration: 1, estimates: result.estimates, insufficient: [], sample: { counts: result.counts, weights: result.weights, effectiveN: result.effectiveN } }, { iteration: 2, estimates: null, insufficient: [0], sample: { counts: [0, 100, 50, 50, 50, 50, 50, 50], weights: [null, 1, 1, 1, 1, 1, 1, 1], effectiveN: null } }];

describe('XLSX exporty populace, vah a výsledků', () => {
  it('populaci uloží do skutečného XLSX a zachová číselné hodnoty a textové seedy', async () => {
    const snapshot = exportSnapshot('population', population, null, [], 'idle');
    const buffer = await serializeExport('population', snapshot);
    expect([...new Uint8Array(buffer).slice(0, 2)]).toEqual([80, 75]);
    const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(buffer);
    const sheet = loaded.getWorksheet('Populace')!;
    expect(sheet.rowCount).toBe(10001);
    expect(sheet.getCell('A2').value).toBe(population.people[0].id);
    expect(sheet.getCell('G2').value).toBe(population.people[0].minutes);
    expect(loaded.getWorksheet('Cíle populace')!.rowCount).toBe(9);
    const metadata = loaded.getWorksheet('Nastavení')!;
    const seedRow = metadata.getRows(2, metadata.rowCount - 1)!.find(row => row.getCell(1).value === 'Seed populace')!;
    expect(seedRow.getCell(2).value).toBe('=1+1');
    expect(seedRow.getCell(2).type).toBe(ExcelJS.ValueType.String);
  }, 15000);
  it('exportuje váhy všech výběrů, přesné populační cíle a prázdnou váhu chybějící skupiny', async () => {
    const snapshot = exportSnapshot('weights', population, config, history, 'stopped');
    expect(snapshot.people).toBeUndefined();
    const workbook = await buildExportWorkbook('weights', snapshot);
    const sheet = workbook.getWorksheet('Váhy výběrů')!;
    expect(sheet.rowCount).toBe(17);
    const first = sheet.getRow(2);
    expect(first.getCell(8).value).toBe(result.counts[0]);
    expect(first.getCell(10).value).toBeCloseTo(population.cells[0].length / population.people.length / (result.counts[0] / config.n));
    expect(sheet.getCell('J10').value).toBeNull();
    expect(sheet.getCell('L10').value).toBe(false);
    const targets = workbook.getWorksheet('Cíle populace')!;
    expect(targets.getCell('E2').value).toBe(.1);
    expect(targets.getColumn(5).numFmt).toBe('0.00%');
  });
  it('u nevážené metody odlišuje jednotkovou váhu od poststratifikační', async () => {
    const workbook = await buildExportWorkbook('weights', exportSnapshot('weights', population, { ...config, method: 'convenience' }, history, 'stopped'));
    expect(workbook.getWorksheet('Váhy výběrů')!.getCell('J2').value).toBe(1);
    expect(workbook.getWorksheet('Váhy výběrů')!.getCell('K2').value).toBeCloseTo(result.weights[0]!);
  });
  it('před simulací poskytne cíle a výsledky odmítne', async () => {
    const snapshot = exportSnapshot('weights', population, null, [], 'idle');
    const workbook = await buildExportWorkbook('weights', snapshot);
    expect(workbook.getWorksheet('Cíle populace')!.rowCount).toBe(9);
    expect(workbook.getWorksheet('Váhy výběrů')!.rowCount).toBe(1);
    await expect(buildExportWorkbook('results', snapshot)).rejects.toThrow();
  });
  it('výsledky obsahují oba odhady, CI a nevydané odhady jako prázdné buňky', async () => {
    const buffer = await serializeExport('results', exportSnapshot('results', population, config, history, 'paused'));
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet('Výsledky vzorků')!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getCell('F2').value).toBeCloseTo(result.estimates!.apple.estimate);
    expect(sheet.getCell('G2').value).toBeCloseTo(result.estimates!.apple.low);
    expect(sheet.getCell('K2').value).toBeCloseTo(result.estimates!.minutes.estimate);
    expect(sheet.getCell('M2').value).toBeCloseTo(result.estimates!.minutes.high);
    expect(sheet.getCell('F2').numFmt).toBe('0.00%');
    expect(sheet.getCell('F3').value).toBeNull();
    expect(sheet.getCell('K3').value).toBeNull();
    expect(sheet.getCell('O3').value).toBe(false);
    expect(sheet.getCell('P3').value).toContain('18–29');
  });
});
