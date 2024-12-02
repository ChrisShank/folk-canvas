import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig, IndexHtmlTransformContext, Plugin } from 'vite';

const files: string[] = readdirSync(__dirname).filter((file) => file.endsWith('.html'));

const input: Record<string, string> = files.reduce((acc, file) => {
  acc[file.replace('.html', '')] = resolve(__dirname, file);
  return acc;
}, {} as Record<string, string>);

const linkGenerator = (): Plugin => {
  return {
    name: 'link-generator',
    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      if (!ctx.filename.endsWith('index.html')) return;

      const links = files
        .filter((file) => !file.includes('index') && !file.startsWith('_'))
        .sort()
        .map((file) => {
          const title = file.replace('.html', '').replaceAll('-', ' ');
          return `<li><a href="${file}">${title}</a></li>`;
        })
        .join('\n');

      return html.replace('{{ LINKS }}', links);
    },
  };
};

const configureResponseHeaders = (): Plugin => {
  return {
    name: 'configure-response-headers',
    configureServer: (server) => {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        next();
      });
    },
  };
};

export default defineConfig({
  plugins: [linkGenerator(), configureResponseHeaders()],
  build: {
    target: 'esnext',
    rollupOptions: { input },
    modulePreload: {
      polyfill: false,
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
});
