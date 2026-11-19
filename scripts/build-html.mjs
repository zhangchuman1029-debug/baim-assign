import { build } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = path.join(root, 'scripts/html-assets');
const manifest = JSON.parse(await readFile(path.join(assets, 'images.json'), 'utf8'));
const images = await Promise.all(Object.entries(manifest).map(async ([url, name]) =>
  [url, `data:image/jpeg;base64,${(await readFile(path.join(assets, name))).toString('base64')}`]
));
let fonts = await readFile(path.join(assets, 'fonts.css'), 'utf8');
for (const name of new Set([...fonts.matchAll(/url\(([^)]+)\)/g)].map(match => match[1]))) {
  fonts = fonts.replaceAll(name, `data:font/ttf;base64,${(await readFile(path.join(assets, name))).toString('base64')}`);
}

// Build the existing application, changing asset references only for this export.
const result = await build({
  root,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'standalone-assets',
    enforce: 'pre',
    transform(source, id) {
      if (id === path.join(root, 'src/data.js')) {
        for (const [url, data] of images) source = source.replaceAll(url, data);
        return source;
      }
      if (id === path.join(root, 'src/styles.css')) {
        return source.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^;]+;/g, '');
      }
    },
  }],
  build: {
    write: false,
    cssCodeSplit: false,
    minify: 'esbuild',
    lib: { entry: path.join(root, 'src/main.jsx'), name: 'UKYWorkspace', formats: ['iife'] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const output = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
const chunks = output.filter(item => item.type === 'chunk');
if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) {
  throw new Error('Standalone export requires one self-contained script.');
}
const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => item.source).join('\n');
if (/@import\s|url\(\s*['"]?https?:/i.test(css)) throw new Error('External stylesheet dependency remains.');
const licenses = (await Promise.all(['DM-Sans-LICENSE.txt', 'Manrope-LICENSE.txt'].map(async name =>
  (await readFile(path.join(assets, name), 'utf8')).replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n')
))).join('\n\n');
const html = `<!doctype html>
<html lang="en">
<!-- Embedded font licenses (DM Sans and Manrope):
${licenses.replaceAll('--', '—')}
-->
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="UKY Centralised Retail Management System — offline interactive prototype" />
  <title>UKY Retail Workspace</title>
  <style>${(fonts + '\n' + css).replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
  <div id="root"></div>
  <noscript>Please enable JavaScript to use the UKY Retail Workspace.</noscript>
  <script>${chunks[0].code.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
const destination = path.join(root, 'UKY_Retail_Management.html');
await writeFile(destination, html);
console.log(`Created ${destination} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
