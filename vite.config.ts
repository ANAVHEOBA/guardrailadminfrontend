import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";

import { solidStart } from "@solidjs/start/config";

export default defineConfig({
  resolve: {
    alias: {
      "source-map-js": fileURLToPath(
        new URL("./src/lib/vendor/source-map-js.ts", import.meta.url),
      ),
    },
  },
  plugins: [solidStart(), nitro()],
});
