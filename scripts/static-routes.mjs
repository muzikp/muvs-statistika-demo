import { copyFile, mkdir } from 'node:fs/promises';

// Pages serves directory indexes, so every application route can be opened directly.
for (const route of ['ci-alfa-explained', 'probability', 'hypothesis-testing', 'law-of-large-numbers', 'central-limit-theorem']) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile('dist/index.html', `dist/${route}/index.html`);
}
await copyFile('dist/index.html', 'dist/404.html');
