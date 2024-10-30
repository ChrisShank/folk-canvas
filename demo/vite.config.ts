import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      input: readdirSync(__dirname)
        .filter((file) => file.endsWith('.html'))
        .reduce((acc, file) => {
          acc[file.replace('.html', '')] = resolve(__dirname, file);
          return acc;
        }, {} as Record<string, string>),
      // input: {
      //   thoughts: resolve(__dirname, 'chains-of-thought/index.html'),
      // },
    },
    modulePreload: {
      polyfill: false,
    },
  },
});
