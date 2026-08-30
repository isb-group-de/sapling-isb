import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type FilesystemDescriptor = {
  fs?: string;
  type?: string;
  mount?: string;
};

type WindowsDriveDescriptor = {
  Name?: string;
  DisplayRoot?: string | null;
  Root?: string;
  Description?: string | null;
};

const execFileAsync = promisify(execFile);
const EXCLUDED_FILESYSTEM_PATTERN =
  /(?:google\s*drive|drivefs|file\s*stream|onedrive|dropbox|icloud|box\s*drive|webdav|rclone|cloud|network|remote|smb|cifs|nfs|fuse)/i;
const WINDOWS_DRIVE_CACHE_MS = 5 * 60_000;

let cachedExcludedWindowsRoots = new Set<string>();
let windowsDriveCacheExpiresAt = 0;

export function filesystemDimension(filesystem: FilesystemDescriptor): string {
  return String(filesystem.mount || filesystem.fs || 'unknown').trim();
}

export function isMonitorableFilesystem(
  filesystem: FilesystemDescriptor,
  excludedWindowsRoots: ReadonlySet<string> = new Set(),
): boolean {
  const combined = [filesystem.fs, filesystem.type, filesystem.mount]
    .filter(Boolean)
    .join(' ');
  if (EXCLUDED_FILESYSTEM_PATTERN.test(combined)) return false;

  const root = normalizeWindowsRoot(filesystem.mount || filesystem.fs);
  return !root || !excludedWindowsRoots.has(root);
}

export async function getExcludedWindowsFilesystemRoots(): Promise<
  ReadonlySet<string>
> {
  if (process.platform !== 'win32') return new Set();
  if (Date.now() < windowsDriveCacheExpiresAt)
    return cachedExcludedWindowsRoots;

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-PSDrive -PSProvider FileSystem | Select-Object Name,DisplayRoot,Root,Description | ConvertTo-Json -Compress',
      ],
      { timeout: 5_000, windowsHide: true },
    );
    const parsed = JSON.parse(stdout || '[]') as
      WindowsDriveDescriptor | WindowsDriveDescriptor[];
    const drives = Array.isArray(parsed) ? parsed : [parsed];
    cachedExcludedWindowsRoots = new Set(
      drives
        .filter(isRemoteOrCloudDrive)
        .map((drive) => normalizeWindowsRoot(drive.Root || drive.Name))
        .filter((root): root is string => Boolean(root)),
    );
  } catch (error) {
    global.log?.warn?.(
      'could not classify Windows filesystem drives for telemetry',
      error,
    );
  }
  windowsDriveCacheExpiresAt = Date.now() + WINDOWS_DRIVE_CACHE_MS;
  return cachedExcludedWindowsRoots;
}

function isRemoteOrCloudDrive(drive: WindowsDriveDescriptor): boolean {
  const displayRoot = String(drive.DisplayRoot || '').trim();
  if (displayRoot.startsWith('\\\\')) return true;
  return EXCLUDED_FILESYSTEM_PATTERN.test(
    [drive.Description, displayRoot].filter(Boolean).join(' '),
  );
}

function normalizeWindowsRoot(value: string | null | undefined): string | null {
  const match = String(value || '')
    .trim()
    .match(/^([a-z]):/i);
  return match ? `${match[1].toUpperCase()}:` : null;
}
