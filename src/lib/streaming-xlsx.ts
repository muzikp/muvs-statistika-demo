import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate } from 'fflate';

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replace a small template's first sheet without retaining uncompressed rows or cell objects. */
export function streamPopulationSheet(template: Uint8Array, count: number, values: (index: number) => (string | number)[], progress?: (completed: number) => void): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const parts: Uint8Array[] = [];
    let length = 0;
    const zip = new Zip((error, chunk, final) => {
      if (error) { reject(error); return; }
      parts.push(chunk); length += chunk.length;
      if (final) {
        const buffer = new Uint8Array(length);
        let offset = 0;
        for (const part of parts) { buffer.set(part, offset); offset += part.length; }
        resolve(buffer.buffer);
      }
    });
    const files = unzipSync(template);
    for (const [name, content] of Object.entries(files)) {
      const entry = new ZipDeflate(name, { level: 1 }); zip.add(entry);
      if (name !== 'xl/worksheets/sheet1.xml') { entry.push(content, true); continue; }
      const xml = strFromU8(content);
      const start = xml.indexOf('<sheetData>') + '<sheetData>'.length;
      const end = xml.indexOf('</sheetData>');
      const header = xml.slice(start, xml.indexOf('</row>', start) + '</row>'.length);
      const range = `A1:I${count + 1}`;
      entry.push(strToU8(xml.slice(0, start).replace(/<dimension ref="[^"]*"/, `<dimension ref="${range}"`) + header));
      progress?.(0);
      for (let first = 0; first < count; first += 1000) {
        const last = Math.min(count, first + 1000);
        let chunk = '';
        for (let index = first; index < last; index++) {
          const row = index + 2;
          chunk += `<row r="${row}">`;
          values(index).forEach((value, column) => {
            const ref = `${String.fromCharCode(65 + column)}${row}`;
            chunk += typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
          });
          chunk += '</row>';
        }
        entry.push(strToU8(chunk)); progress?.(last);
      }
      entry.push(strToU8(xml.slice(end).replace(/<autoFilter ref="[^"]*"/, `<autoFilter ref="${range}"`)), true);
    }
    zip.end();
  });
}
