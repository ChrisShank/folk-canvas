import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig, IndexHtmlTransformContext, Plugin } from 'vite';

const canvasWebsiteDir = resolve(__dirname, 'website/canvas');

function getCanvasFiles() {
  return readdirSync(canvasWebsiteDir).filter((file) => file.endsWith('.html'));
}

const linkGenerator = (): Plugin => {
  return {
    name: 'link-generator',
    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      if (!ctx.filename.endsWith('canvas/index.html')) return;
      const files = getCanvasFiles();
      // First, handle ungrouped files
      const ungroupedFiles = files.filter(
        (file) => !file.includes('index') && !file.startsWith('_') && !file.match(/^\[([^\]]+)\]/)
      );

      // Then handle grouped files
      const groups = files
        .filter((file) => !file.includes('index') && file.match(/^\[([^\]]+)\]/))
        .reduce((acc, file) => {
          const match = file.match(/^\[([^\]]+)\](.+)\.html$/);
          const group = match![1];
          if (!acc[group]) acc[group] = [];
          acc[group].push(file);
          return acc;
        }, {} as Record<string, string[]>);

      // Generate ungrouped HTML first
      const ungroupedHtml = ungroupedFiles
        .sort()
        .map((file) => {
          const title = file.replace('.html', '').replaceAll('-', ' ');
          return `<li><a href="${file}">${title}</a></li>`;
        })
        .join('\n');

      // Then generate grouped HTML
      const groupedHtml = Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, groupFiles]) => {
          const groupHtml = groupFiles
            .sort()
            .map((file) => {
              const title = file
                .replace(/^\[[^\]]+\]/, '')
                .replace('.html', '')
                .replaceAll('-', ' ');
              return `<li><a href="${file}">${title}</a></li>`;
            })
            .join('\n');

          return `<h2>${group.replaceAll('-', ' ')}</h2>\n<ul>${groupHtml}</ul>`;
        })
        .join('\n');

      return html.replace('{{ LINKS }}', `${ungroupedHtml}\n${groupedHtml}`);
    },
  };
};

export default defineConfig({
  root: 'website',
  plugins: [linkGenerator()],
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'website/index.html'),
        ...getCanvasFiles().reduce((acc, file) => {
          acc[`canvas/${file.replace('.html', '')}`] = resolve(canvasWebsiteDir, file);
          return acc;
        }, {} as Record<string, string>),
      },
    },
    modulePreload: {
      polyfill: false,
    },
    outDir: './dist',
    emptyOutDir: true,
  },
});
