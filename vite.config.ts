import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig, IndexHtmlTransformContext, Plugin } from 'vite';

const demoDir = resolve(__dirname, 'demo');

const files: string[] = readdirSync(demoDir).filter((file) => file.endsWith('.html') && !file.startsWith('_'));
const input: Record<string, string> = files.reduce((acc, file) => {
  acc[file.replace('.html', '')] = resolve(demoDir, file);
  return acc;
}, {} as Record<string, string>);

const linkGenerator = (): Plugin => {
  return {
    name: 'link-generator',
    transformIndexHtml(html: string, ctx: IndexHtmlTransformContext) {
      if (!ctx.filename.endsWith('index.html')) return;

      // First, handle ungrouped files
      const ungroupedFiles = files.filter((file) => !file.includes('index') && !file.match(/^\[([^\]]+)\]/));

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
  root: 'demo',
  plugins: [linkGenerator()],
  build: {
    target: 'esnext',
    rollupOptions: { input },
    modulePreload: {
      polyfill: false,
    },
    outDir: './dist',
    emptyOutDir: true,
  },
});
