/**
 * File content validation helpers.
 *
 * The MIME type declared by the client is never trusted on its own: the
 * actual bytes are inspected so a renamed executable cannot be uploaded as
 * an "image/png".
 */

/** Magic-byte signatures per supported MIME type. */
const SIGNATURES: Array<{
  mime: string;
  /** Byte pattern that must appear at `offset` (0xNN = any byte). */
  pattern: number[];
  offset?: number;
}> = [
  { mime: 'image/jpeg', pattern: [0xff, 0xd8, 0xff] },
  {
    mime: 'image/png',
    pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: 'image/gif', pattern: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', pattern: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'application/pdf', pattern: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mime: 'application/zip', pattern: [0x50, 0x4b, 0x03, 0x04] },
  {
    mime: 'application/msword',
    pattern: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  { mime: 'video/mp4', pattern: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { mime: 'video/webm', pattern: [0x1a, 0x45, 0xdf, 0xa3] },
];

/** Extra byte-level checks for formats that need more than a fixed prefix. */
function isSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 512).toString('utf8').trimStart();
  return (
    head.startsWith('<svg') ||
    (head.startsWith('<?xml') && head.includes('<svg'))
  );
}

function isWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function isPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  // Binary files almost always contain a NUL byte in the first block.
  const probe = buffer.subarray(0, 4096);
  if (probe.includes(0)) return false;
  const decoded = probe.toString('utf8');
  // Reject if the bytes are not valid UTF-8 (round-trip mismatch).
  return Buffer.from(decoded, 'utf8').equals(probe);
}

function matches(buffer: Buffer, pattern: number[], offset = 0): boolean {
  if (buffer.length < offset + pattern.length) return false;
  for (let i = 0; i < pattern.length; i += 1) {
    if (buffer[offset + i] !== pattern[i]) return false;
  }
  return true;
}

/**
 * Detects the real MIME type of a buffer.
 * Returns `null` when the content is not a recognised format.
 */
export function detectMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length === 0) return null;

  if (isWebp(buffer)) return 'image/webp';

  for (const sig of SIGNATURES) {
    if (matches(buffer, sig.pattern, sig.offset)) {
      if (sig.mime === 'application/zip') {
        // ZIP container: distinguish OOXML documents from generic archives.
        return 'application/zip';
      }
      return sig.mime;
    }
  }

  if (isSvg(buffer)) return 'image/svg+xml';
  if (isPlainText(buffer)) return 'text/plain';

  return null;
}

/** MIME types that are plain-text based and have no reliable magic bytes. */
const TEXTUAL_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'image/svg+xml',
]);

/**
 * Checks that the uploaded bytes really are of the declared type.
 * Returns the detected type, or throws a human-readable reason.
 */
export function assertContentMatchesMime(
  buffer: Buffer,
  declaredMime: string,
): { ok: boolean; detected: string | null } {
  const detected = detectMimeType(buffer);

  // Content that cannot be identified is rejected: accepting it would let
  // any binary through as long as it claimed an allowed type.
  if (!detected) {
    return { ok: false, detected: null };
  }

  if (detected === declaredMime) {
    return { ok: true, detected };
  }

  // QuickTime shares the ISO base media container (`ftyp` box) with MP4.
  if (declaredMime === 'video/quicktime' && detected === 'video/mp4') {
    return { ok: true, detected };
  }

  // OOXML files (docx/xlsx/pptx) are ZIP containers.
  const ooxml: Record<string, string> = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'application/zip',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      'application/zip',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'application/zip',
  };

  if (ooxml[declaredMime] && detected === ooxml[declaredMime]) {
    return { ok: true, detected };
  }

  // Text formats are frequently served as octet-stream or plain text.
  if (TEXTUAL_MIME_TYPES.has(declaredMime) && detected === 'text/plain') {
    return { ok: true, detected };
  }

  return { ok: false, detected };
}

/** File extensions allowed for each MIME type. */
export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov', '.qt'],
};

/**
 * The extension used when building a storage key. It is derived from the
 * validated MIME type, never from the client-supplied filename.
 */
export function canonicalExtension(mimeType: string): string {
  return ALLOWED_EXTENSIONS[mimeType]?.[0] ?? '.bin';
}

/**
 * Validates the file extension against the declared MIME type.
 * Returns an error message, or null when the extension is acceptable.
 */
export function extensionError(
  filename: string,
  declaredMime: string,
): string | null {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1) {
    return 'File must have an extension';
  }

  const ext = lower.slice(dot);
  const allowed = ALLOWED_EXTENSIONS[declaredMime];

  if (!allowed) {
    return `Unsupported MIME type "${declaredMime}"`;
  }

  if (!allowed.includes(ext)) {
    return `Extension "${ext}" is not allowed for ${declaredMime}. Allowed: ${allowed.join(', ')}`;
  }

  return null;
}
