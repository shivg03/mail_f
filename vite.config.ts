import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import path from "path";
import svgr from "vite-plugin-svgr"; // ✅ Added here
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const _dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    svgr(), // ✅ Added here in plugins array
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(_dirname, "client", "src"),
      "@shared": path.resolve(_dirname, "shared"),
      "@assets": path.resolve(_dirname, "attached_assets"),
    },
  },
  root: path.resolve(_dirname, "client"),
  build: {
    outDir: path.resolve(_dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',  
    port: 3000, 
  },
});
