// Shared attachment validation for email_inbox module
// Owner decision Q4 (2026-08-13): 25MB cap + executable blocklist

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.app', '.msi', '.scr',
  '.com', '.pif', '.vbs', '.js', '.jar', '.wsf', '.hta', '.cpl',
  '.dll', '.sys', '.drv', '.ocx', '.reg', '.inf', '.iso', '.bin',
];

export interface AttachmentValidationResult {
  ok: boolean;
  error?: string;
  code?: 'too_large' | 'blocked_type';
}

export function validateAttachment(filename: string, size: number): AttachmentValidationResult {
  // Size check
  if (size > MAX_ATTACHMENT_SIZE) {
    return {
      ok: false,
      error: `File exceeds 25MB limit (${(size / 1024 / 1024).toFixed(2)}MB)`,
      code: 'too_large',
    };
  }

  // Extension check
  const lower = filename.toLowerCase();
  const blocked = BLOCKED_EXTENSIONS.find(ext => lower.endsWith(ext));
  if (blocked) {
    return {
      ok: false,
      error: `File type ${blocked} is not allowed for security reasons`,
      code: 'blocked_type',
    };
  }

  return { ok: true };
}
