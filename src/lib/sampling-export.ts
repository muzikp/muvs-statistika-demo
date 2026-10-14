import { t } from './texts';
import type { Workbook, Worksheet } from 'exceljs';
import { AGE_GROUPS, SEXES, EDUCATION, PHONES, METHODS } from './sampling';
import type { Person, Population, PopulationSpec, SamplingConfig, SamplingIteration } from './sampling';

export type ExportKind = 'population' | 'weights' | 'results';
export interface ExportSnapshot {
  population: { spec: PopulationSpec; counts: number[]; apple: number; minutes: number };
  people?: Person[];
  config: SamplingConfig | null;
  history: SamplingIteration[];
  status: string;
}
export type ExportProgress = { type: 'progress'; stage: 'rows' | 'packaging'; completed: number; total: number };
export type ExportMessage = ExportProgress | { type: 'ready'; filename: string; buffer: ArrayBuffer } | { type: 'error'; message: string };
export const EXPORT_FILENAMES: Record<ExportKind, string> = { population: 'populace.xlsx', weights: 'vahy.xlsx', results: 'vysledky-vzorku.xlsx' };
const cellName = (h: number) => `${AGE_GROUPS[Math.floor(h / 2)]} · ${SEXES[h % 2]}`;
const methodName = (config: SamplingConfig | null) => config ? METHODS.find(method => method.id === config.method)!.name : t('xlsx.vyberyZatimNeprobehly');

export function exportSnapshot(kind: ExportKind, population: Population, config: SamplingConfig | null, history: SamplingIteration[], status: string): ExportSnapshot {
  return { population: { spec: population.spec, counts: population.cells.map(cell => cell.length), apple: population.apple, minutes: population.minutes }, people: kind === 'population' ? population.people : undefined, config, history: kind === 'population' ? [] : history, status };
}
function sheet(workbook: Workbook, name: string, headers: string[], percentages: number[] = []) {
  const result = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  result.columns = headers.map(header => ({ header, width: Math.min(42, Math.max(16, header.length + 2)) }));
  result.getRow(1).height = 38;
  result.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  result.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E574A' } };
  result.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  percentages.forEach(column => { result.getColumn(column).numFmt = '0.00%'; });
  result.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  return result;
}
function targets(workbook: Workbook, snapshot: ExportSnapshot) {
  const result = sheet(workbook, t('xlsx.cilePopulace'), [t('xlsx.skupinaId'), t('xlsx.vekovaSkupina'), t('xlsx.pohlavi'), t('xlsx.pocetVPopulaciN'), t('xlsx.populacniPodilW')], [5]);
  snapshot.population.counts.forEach((count, h) => result.addRow([h + 1, AGE_GROUPS[Math.floor(h / 2)], SEXES[h % 2], count, count / snapshot.population.spec.size]));
}
function metadata(workbook: Workbook, snapshot: ExportSnapshot, kind: ExportKind) {
  const meta = sheet(workbook, t('xlsx.nastaveni'), [t('xlsx.polozka'), t('xlsx.hodnota')]); meta.getColumn(1).width = 43; meta.getColumn(2).width = 100;
  const { population, config, history } = snapshot;
  const rows: (string | number)[][] = [
    [t('xlsx.export'), kind === 'population' ? t('xlsx.celaSyntetickaPopulace') : kind === 'weights' ? t('xlsx.populacniCileAVahyDokoncenychVyberu') : t('xlsx.bodoveOdhadyAIntervalyDokoncenychVyberu')],
    [t('xlsx.data'), t('xlsx.syntetickaVyukovaPopulaceNejdeOSkutecnaDataO')],
    [t('xlsx.casExportuUtc'), new Date().toISOString()], [t('xlsx.pocetLidiVPopulaciN'), population.spec.size], [t('xlsx.seedPopulace'), population.spec.seed],
    [t('xlsx.skutecnyPodilApple0Az1'), population.apple], [t('xlsx.skutecnyPrumerInternetuMinTyden'), population.minutes],
    [t('xlsx.metodaPoslednihoSpustenehoBehu'), methodName(config)], [t('xlsx.stavBehuVOkamzikuExportu'), ({ idle: t('xlsx.pripraveno'), running: t('xlsx.simulaceBezi'), paused: t('xlsx.pozastaveno'), stopped: t('xlsx.zastaveno'), completed: t('xlsx.dokonceno'), error: t('xlsx.chyba') } as Record<string, string>)[snapshot.status] ?? snapshot.status],
    [t('xlsx.exportovaneDokonceneVybery'), history.length],
    [t('xlsx.jednotky'), t('xlsx.podilyJsouUlozenyJakoCisla0Az1')],
    [t('xlsx.neplatnyOdhad'), t('xlsx.prazdnyBodovyOdhadACiZnamenajiNevydanyOdhad')]
  ];
  if (config) rows.push([t('xlsx.velikostVzorkuN'), config.n], [t('xlsx.planovanyPocetVyberu'), config.repeats], [t('xlsx.spolehlivost0Az1'), config.confidence], [t('xlsx.seedVyberu'), config.seed], [t('xlsx.demografickeZkresleni'), config.demographicBias], [t('xlsx.zkresleniUvnitrSkupin'), config.outcomeBias], [t('xlsx.vypocetCi'), t('xlsx.normalniAproximaceUPravdepodobnostnichVyberuRozptylZohlednujeZpusob')]);
  if (kind === 'weights') rows.push([t('xlsx.vahaPodleMetody'), t('xlsx.uNahodnehoANevazenehoPrilezitostnehoVyberu1U')], [t('xlsx.poststratifikacniVaha'), t('xlsx.wNNUvedenaProPorovnaniUVsech')], [t('xlsx.predSpustenimSimulace'), t('xlsx.sesitObsahujeZnamePopulacniCileVahyVyberuSe')], [t('xlsx.intervalyPrilezitostnehoSberu'), t('xlsx.pracovniAproximaceNezahrnujiVyberoveZkresleni')]);
  rows.forEach(row => meta.addRow(row));
  meta.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
}
export async function buildExportWorkbook(kind: ExportKind, snapshot: ExportSnapshot, onProgress?: (progress: ExportProgress) => void): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook(); workbook.creator = t('xlsx.statistickaLaboratorMuvs');
  const total = kind === 'population' ? snapshot.people?.length ?? 0 : kind === 'weights' ? snapshot.history.length * snapshot.population.counts.length : snapshot.history.length;
  const progress = (completed: number) => { if (completed === 0 || completed % 1000 === 0 || completed === total) onProgress?.({ type: 'progress', stage: 'rows', completed, total }); };
  progress(0);
  let data: Worksheet;
  if (kind === 'population') {
    if (!snapshot.people?.length) throw new Error(t('xlsx.populaceJesteNeniPripravena'));
    data = sheet(workbook, t('xlsx.populace'), [t('xlsx.idOsoby'), t('xlsx.vek'), t('xlsx.vekovaSkupina'), t('xlsx.pohlavi'), t('xlsx.vzdelani'), t('xlsx.telefon'), t('xlsx.internetMinTyden'), t('xlsx.skupinaId'), t('xlsx.apple1Ano')]);
    snapshot.people.forEach((person, index) => { data.addRow([person.id, person.age, AGE_GROUPS[Math.floor(person.cell / 2)], SEXES[person.sex], EDUCATION[person.education], PHONES[person.phone], person.minutes, person.cell + 1, Number(person.phone === 0)]); progress(index + 1); });
    targets(workbook, snapshot);
  } else if (kind === 'weights') {
    targets(workbook, snapshot);
    data = sheet(workbook, t('xlsx.vahyVyberu'), [t('xlsx.vyber'), t('xlsx.metoda'), t('xlsx.skupinaId'), t('xlsx.vekovaSkupina'), t('xlsx.pohlavi'), t('xlsx.pocetVPopulaciN'), t('xlsx.populacniPodilW'), t('xlsx.pocetVeVzorkuN'), t('xlsx.podilVeVzorku'), t('xlsx.vahaPodleMetody'), t('xlsx.poststratifikacniVaha'), t('xlsx.odhadVydan'), t('xlsx.poznamka')], [7, 9]);
    let completed = 0;
    snapshot.history.forEach(entry => snapshot.population.counts.forEach((count, h) => {
      const sampleCount = entry.sample?.counts[h] ?? null;
      const share = sampleCount !== null && snapshot.config ? sampleCount / snapshot.config.n : null;
      const postWeight = share ? count / snapshot.population.spec.size / share : null;
      const grouped = snapshot.config?.method === 'weighted' || snapshot.config?.method === 'stratified';
      const weight = sampleCount ? grouped ? postWeight : 1 : null;
      data.addRow([entry.iteration, methodName(snapshot.config), h + 1, AGE_GROUPS[Math.floor(h / 2)], SEXES[h % 2], count, count / snapshot.population.spec.size, sampleCount, share, weight, postWeight, entry.estimates !== null, sampleCount === null ? t('xlsx.slozeniVzorkuNezaznamenano') : entry.insufficient.includes(h) ? t('xlsx.meneNez2RespondentiOdhadNebylVydan') : !sampleCount ? t('xlsx.skupinaBezRespondentu') : '']);
      progress(++completed);
    }));
  } else {
    if (!snapshot.config || !snapshot.history.length) throw new Error(t('xlsx.nejprveDokonceteAlesponJedenVyber'));
    data = sheet(workbook, t('xlsx.vysledkyVzorku'), [t('xlsx.vyber'), t('xlsx.metoda'), t('xlsx.velikostVzorkuN'), t('xlsx.spolehlivost'), t('xlsx.appleSkutecnost'), t('xlsx.appleBodovyOdhad'), t('xlsx.appleCiDolni'), t('xlsx.appleCiHorni'), t('xlsx.appleIntervalMimo'), t('xlsx.internetSkutecnostMinTyden'), t('xlsx.internetBodovyOdhad'), t('xlsx.internetCiDolni'), t('xlsx.internetCiHorni'), t('xlsx.internetIntervalMimo'), t('xlsx.odhadVydan'), t('xlsx.nedostatecneSkupiny'), t('xlsx.efektivniNPodleKishe')], [4, 5, 6, 7, 8]);
    [10, 11, 12, 13, 17].forEach(column => { data.getColumn(column).numFmt = '0.00'; });
    snapshot.history.forEach((entry, index) => {
      const apple = entry.estimates?.apple, minutes = entry.estimates?.minutes;
      data.addRow([entry.iteration, methodName(snapshot.config), snapshot.config!.n, snapshot.config!.confidence, snapshot.population.apple, apple?.estimate ?? null, apple?.low ?? null, apple?.high ?? null, apple?.outside ?? null, snapshot.population.minutes, minutes?.estimate ?? null, minutes?.low ?? null, minutes?.high ?? null, minutes?.outside ?? null, entry.estimates !== null, entry.insufficient.map(cellName).join(', '), entry.sample?.effectiveN ?? null]);
      progress(index + 1);
    });
  }
  metadata(workbook, snapshot, kind);
  return workbook;
}
export async function serializeExport(kind: ExportKind, snapshot: ExportSnapshot, onProgress?: (progress: ExportProgress) => void): Promise<ArrayBuffer> {
  if (kind === 'population' && (snapshot.people?.length ?? 0) > 100000) {
    const people = snapshot.people!;
    const workbook = await buildExportWorkbook(kind, { ...snapshot, people: [people[0]] });
    const template = new Uint8Array(await workbook.xlsx.writeBuffer());
    const { streamPopulationSheet } = await import('./streaming-xlsx');
    return streamPopulationSheet(template, people.length, index => {
      const person = people[index];
      return [person.id, person.age, AGE_GROUPS[Math.floor(person.cell / 2)], SEXES[person.sex], EDUCATION[person.education], PHONES[person.phone], person.minutes, person.cell + 1, Number(person.phone === 0)];
    }, completed => onProgress?.({ type: 'progress', stage: 'rows', completed, total: people.length }));
  }
  const workbook = await buildExportWorkbook(kind, snapshot, onProgress);
  onProgress?.({ type: 'progress', stage: 'packaging', completed: 0, total: 0 });
  const buffer = await workbook.xlsx.writeBuffer();
  const result = new Uint8Array(buffer.byteLength); result.set(new Uint8Array(buffer)); return result.buffer;
}
