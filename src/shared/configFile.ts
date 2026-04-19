import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_DIR = '~/.fluxflow';
const CONFIG_FILE = 'config.json';

function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function getDataDir(customDir?: string): string {
  const dir = customDir || DEFAULT_DIR;
  return expandHome(dir);
}

export function getConfigPath(customDir?: string): string {
  return path.join(getDataDir(customDir), CONFIG_FILE);
}

export function ensureDataDir(customDir?: string): void {
  const dir = getDataDir(customDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
