import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
import type { BootChunk, BootConfig } from './src/boot/bootLoader';

const BOOT_LOADER = fileURLToPath(new URL('./src/boot/bootLoader.ts', import.meta.url));
const ENTRY_TAG = /<script type="module" crossorigin src="([^"]+)"><\/script>\s*/;
const PRELOAD_TAG = /<link rel="modulepreload" crossorigin href="([^"]+)">\s*/g;

/**
 * Inlines src/boot/bootLoader.ts so the stitched progress bar paints before any chunk arrives.
 * In builds it also takes over loading the JS: the loader fetches every chunk with byte progress,
 * then injects the entry module, which the browser serves from the HTTP cache.
 */
function bootLoaderPlugin(): Plugin {
  return {
    name: 'cat-season-boot-loader',
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        const { code } = await transformWithEsbuild(readFileSync(BOOT_LOADER, 'utf8'), BOOT_LOADER, {
          format: 'iife',
          globalName: 'CatBoot',
          minify: true,
          target: 'es2019',
        });

        let config: BootConfig | null = null;
        let page = html;
        const entry = ctx.bundle ? ENTRY_TAG.exec(html) : null;
        if (ctx.bundle && entry) {
          const urls = [entry[1], ...Array.from(html.matchAll(PRELOAD_TAG), (match) => match[1])];
          const chunks: BootChunk[] = urls.map((url) => {
            const chunk = Object.values(ctx.bundle ?? {}).find((item) => item.type === 'chunk' && url.endsWith(item.fileName));
            if (!chunk || chunk.type !== 'chunk') {
              throw new Error(`boot loader: no chunk for ${url}`);
            }
            return { url, size: Buffer.byteLength(chunk.code) };
          });
          config = { entry: entry[1], chunks };
          page = html.replace(ENTRY_TAG, '').replace(PRELOAD_TAG, '');
        }

        return page.replace('</body>', `<script>${code}CatBoot.start(${JSON.stringify(config)});</script>\n</body>`);
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [bootLoaderPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
