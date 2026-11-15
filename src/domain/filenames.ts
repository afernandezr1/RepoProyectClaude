const ALLOWED_EXTENSIONS = ['json', 'csv'] as const;
export type ExportExtension = (typeof ALLOWED_EXTENSIONS)[number];

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
const MAX_BASE_LENGTH = 60;

/**
 * Produce a filename that is safe on iOS, Android, macOS, Windows and Linux:
 * lowercase ASCII letters, digits, '-' and '_' only; no path separators, no
 * leading dots, no reserved device names, bounded length, whitelisted extension.
 */
export function safeFilename(base: string, ext: string, date?: Date): string {
  const extension = ext.toLowerCase().replace(/^\.+/, '');
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error(`Unsupported export type: ${ext}`);
  }
  let slug = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  if (slug.length === 0) slug = 'export';
  if (WINDOWS_RESERVED.test(slug)) slug = `${slug}-file`;
  if (slug.length > MAX_BASE_LENGTH) slug = slug.slice(0, MAX_BASE_LENGTH).replace(/[-_]+$/, '');
  const stamp = date ? `-${stampFor(date)}` : '';
  return `${slug}${stamp}.${extension}`;
}

function stampFor(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
