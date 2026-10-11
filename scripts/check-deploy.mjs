import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Cloudflare Pages rejects individual assets larger than 25 MiB.
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if ((await stat(path)).size > 25 * 1024 * 1024) {
      throw new Error(`Cloudflare Pages: asset exceeds 25 MiB: ${path}`);
    }
  }
}
await check('dist');
console.log('Cloudflare Pages: all assets within the 25 MiB limit.');
