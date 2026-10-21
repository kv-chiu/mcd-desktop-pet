import fs from 'node:fs';
import { getPidFilePath } from './paths.js';
import type { ServerProcessInfo } from '../types.js';

export function isPidRunning(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

export function readPidFile(): ServerProcessInfo | null {
  const pidPath = getPidFilePath();
  if (!fs.existsSync(pidPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(pidPath, 'utf-8').trim();
    if (!content) return null;

    if (content.startsWith('{')) {
      const parsed = JSON.parse(content);
      if (typeof parsed.pid === 'number') {
        return parsed as ServerProcessInfo;
      }
    } else {
      const numericPid = parseInt(content, 10);
      if (!isNaN(numericPid)) {
        return {
          pid: numericPid,
          port: 3001,
          startTime: '',
          entryScript: '',
        };
      }
    }
  } catch {
  }
  return null;
}

export function writePidFile(info: ServerProcessInfo): void {
  const pidPath = getPidFilePath();
  fs.writeFileSync(pidPath, JSON.stringify(info, null, 2), 'utf-8');
}

export function removePidFile(): void {
  const pidPath = getPidFilePath();
  if (fs.existsSync(pidPath)) {
    try {
      fs.unlinkSync(pidPath);
    } catch {
    }
  }
}

export function tailFile(filePath: string, maxLines = 20): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
