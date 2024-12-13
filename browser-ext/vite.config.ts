import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      webExtConfig: {
        startUrl: ['https://www.humprog.org/~stephen/'],
      },
    }) as any,
  ],
});
