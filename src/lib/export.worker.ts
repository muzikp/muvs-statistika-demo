import { t } from './texts';
import { EXPORT_FILENAMES, serializeExport } from './sampling-export';
import type { ExportKind, ExportSnapshot, ExportMessage } from './sampling-export';

const send = (message: ExportMessage) => self.postMessage(message);
self.onmessage = async ({ data }: MessageEvent<{ kind: ExportKind; snapshot: ExportSnapshot }>) => {
  try {
    const buffer = await serializeExport(data.kind, data.snapshot, send);
    self.postMessage({ type: 'ready', filename: EXPORT_FILENAMES[data.kind], buffer } satisfies ExportMessage, { transfer: [buffer] });
  } catch (error) { send({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
