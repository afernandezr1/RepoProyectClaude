/**
 * Writing exports to the app's own document directory and handing them to the
 * system share sheet. Nothing is uploaded anywhere by the app itself.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { IS_PAGE_BUILD } from '../db/expoDb';
import { safeFilename, type ExportExtension } from '../domain/filenames';

export const EXPORT_DIR_NAME = 'exports';

export interface SavedExport {
  filename: string;
  /** file:// URI on device; null on web (downloaded by the browser). */
  uri: string | null;
  shared: boolean;
}

function exportsDir(): Directory {
  const dir = new Directory(Paths.document, EXPORT_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

const MIME: Record<ExportExtension, string> = { json: 'application/json', csv: 'text/csv' };

export async function saveAndShare(base: string, ext: ExportExtension, content: string): Promise<SavedExport> {
  const filename = safeFilename(base, ext, new Date());
  if (IS_PAGE_BUILD) {
    await saveThroughClaude(filename, content);
    return { filename, uri: null, shared: true };
  }
  if (Platform.OS === 'web') {
    downloadOnWeb(filename, content, MIME[ext]);
    return { filename, uri: null, shared: true };
  }
  const file = new File(exportsDir(), filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(file.uri, { mimeType: MIME[ext], dialogTitle: 'Save or send your export' });
      shared = true;
    } catch {
      shared = false; // user dismissed or share target failed; file is still saved locally
    }
  }
  return { filename, uri: file.uri, shared };
}

interface DownloadsNs {
  save(req: { filename: string; data: string }): Promise<{ status: string }>;
}

/** Published Claude page: files are offered through the viewer's save prompt. */
async function saveThroughClaude(filename: string, content: string): Promise<void> {
  const claude = (globalThis as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
  const downloads = claude ? ((await claude.use('downloads')) as DownloadsNs | null) : null;
  if (!downloads) throw new Error('Saving files is not available in this view. Open the page in claude.ai to export.');
  try {
    await downloads.save({ filename, data: content });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') throw new Error('Save cancelled.');
    if (code === 'rate_limited') throw new Error('Another save is waiting for confirmation. Try again in a moment.');
    throw new Error('Saving files is not available in this view.');
  }
}

function downloadOnWeb(filename: string, content: string, mime: string): void {
  const g = globalThis as unknown as {
    document?: { createElement(tag: string): { href: string; download: string; click(): void } };
    URL?: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void };
    Blob?: new (parts: string[], opts: { type: string }) => unknown;
  };
  if (!g.document || !g.URL || !g.Blob) throw new Error('Downloads are not supported in this browser.');
  const url = g.URL.createObjectURL(new g.Blob([content], { type: mime }));
  const a = g.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  g.URL.revokeObjectURL(url);
}

/** Let the user pick a backup file. Returns null if they cancel. */
export async function pickBackupText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || res.assets.length === 0) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    const f = asset.file as unknown as { text?: () => Promise<string> } | undefined;
    if (f?.text) return f.text();
    const r = await fetch(asset.uri);
    return r.text();
  }
  return new File(asset.uri).text();
}

/** Remove any export files the app wrote. Used by full deletion. */
export function deleteExportFiles(): void {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, EXPORT_DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // Directory may not exist; nothing to delete.
  }
}

export function documentDirectoryUri(): string | null {
  if (Platform.OS === 'web') return null;
  try {
    return Paths.document.uri;
  } catch {
    return null;
  }
}
