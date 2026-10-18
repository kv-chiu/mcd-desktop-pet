import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getDataDir(): string {
  const dir = path.join(os.homedir(), '.mcd-desktop-pet');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getPidFilePath(): string {
  return path.join(getDataDir(), 'server.pid');
}

export function getLogFilePath(): string {
  return path.join(getDataDir(), 'server.log');
}

export function getConfigFilePath(): string {
  return path.join(getDataDir(), 'config.json');
}

export function readConfigPort(): number {
  try {
    const configPath = getConfigFilePath();
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (typeof parsed.port === 'number' && parsed.port > 0) {
        return parsed.port;
      }
    }
  } catch {
    // ignore read/parse error, fallback to default
  }
  return 3001;
}

export interface ServerLocation {
  serverDir: string;
  entryScript: string;
  isTypeScript: boolean;
}

export function findServerEntry(): ServerLocation | null {
  const candidates: string[] = [];

  if (process.env.MCD_SERVER_DIR) {
    candidates.push(path.resolve(process.env.MCD_SERVER_DIR));
  }

  // From cli/src/utils or cli/dist/utils -> root/server
  candidates.push(path.resolve(__dirname, '../../../server'));
  // From cli/src or cli/dist -> root/server
  candidates.push(path.resolve(__dirname, '../../server'));
  // From cwd
  candidates.push(path.resolve(process.cwd(), 'server'));
  candidates.push(path.resolve(process.cwd()));

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;

    const distPath = path.join(dir, 'dist', 'index.js');
    if (fs.existsSync(distPath)) {
      return {
        serverDir: dir,
        entryScript: distPath,
        isTypeScript: false,
      };
    }

    const srcPath = path.join(dir, 'src', 'index.ts');
    if (fs.existsSync(srcPath)) {
      return {
        serverDir: dir,
        entryScript: srcPath,
        isTypeScript: true,
      };
    }
  }

  return null;
}
