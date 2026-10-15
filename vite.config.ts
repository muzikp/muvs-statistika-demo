import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { dictionary, t } from './src/lib/texts';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, '.', 'GITHUB_').GITHUB_PAGES === 'true' ? '/muvs-statistika-demo/' : '/',
  plugins: [svelte(), {
    name: 'site-texts',
    transformIndexHtml(html) {
      return html.replace('__SITE_TITLE__', escapeHtml(t('app.pageTitle', { pageTitle: t('app.statistickaLaborator') })))
        .replace('__SITE_DESCRIPTION__', escapeHtml(dictionary.meta.description));
    }
  }],
  worker: { format: 'es' }
}));
