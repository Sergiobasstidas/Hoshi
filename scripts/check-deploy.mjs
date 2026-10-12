import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Cloudflare Pages rechaza archivos individuales de más de 25 MiB.
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if ((await stat(path)).size > 25 * 1024 * 1024) {
      throw new Error(`Cloudflare Pages: archivo superior a 25 MiB: ${path}`);
    }
  }
}
await check('dist');
console.log('Cloudflare Pages: todos los archivos cumplen el límite de 25 MiB.');
