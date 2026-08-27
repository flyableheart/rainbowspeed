import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 3,
        unsafe_arrows: true,
        drop_console: true,
      },
      mangle: {
        properties: { regex: /^_/ },
      },
    },
    assetsInlineLimit: 100000,
    modulePreload: false,
  },
});
