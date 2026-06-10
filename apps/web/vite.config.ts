import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindcss = require("tailwindcss");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const autoprefixer = require("autoprefixer");

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: "./tailwind.config.js" }),
        autoprefixer(),
      ],
    },
  },
  server: {
    port: 3000,
  },
  preview: {
    allowedHosts: true,
  },
});
