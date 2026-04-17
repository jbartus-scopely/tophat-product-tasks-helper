import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = resolve(__dirname, '..', '.cache');
function ensureCacheDir() {
    if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
    }
}
function cacheKey(command, prompt) {
    const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 12);
    return `${command}-${hash}`;
}
function cachePath(key) {
    return resolve(CACHE_DIR, `${key}.txt`);
}
export function getCached(command, prompt) {
    const path = cachePath(cacheKey(command, prompt));
    if (existsSync(path)) {
        console.log(chalk.dim('  Using cached AI response'));
        return readFileSync(path, 'utf-8');
    }
    return null;
}
export function getLastCached(command) {
    // Read the latest pointer for this command
    const pointerPath = resolve(CACHE_DIR, `${command}-latest.txt`);
    if (existsSync(pointerPath)) {
        const targetPath = readFileSync(pointerPath, 'utf-8').trim();
        if (existsSync(targetPath)) {
            console.log(chalk.dim('  Using cached AI response'));
            return readFileSync(targetPath, 'utf-8');
        }
    }
    return null;
}
export function saveCache(command, prompt, response) {
    ensureCacheDir();
    const key = cacheKey(command, prompt);
    const path = cachePath(key);
    writeFileSync(path, response, 'utf-8');
    // Also save a "latest" pointer for this command
    const pointerPath = resolve(CACHE_DIR, `${command}-latest.txt`);
    writeFileSync(pointerPath, path, 'utf-8');
}
//# sourceMappingURL=cache.js.map