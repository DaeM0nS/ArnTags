import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // const isNative = mode === 'native'

  return {
    //    base: isNative ? './' : '/Arntags/',
    // base: './',
    base: mode === 'github-pages'
      ? '/Arntags/'
      : '/',
    build: {
      target: 'es2019',
      sourcemap: false,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false
        },
        injectRegister: 'script-defer',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'ArnTags',
          short_name: 'ArnTags',
          description: 'Cartes nfc vêtements Arntreal.',
          theme_color: '#ffffff',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      })
    ]
  }
})