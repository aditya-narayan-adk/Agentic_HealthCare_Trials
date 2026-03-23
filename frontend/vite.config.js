import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,   // bind to 0.0.0.0 — required for Docker port forwarding
    proxy: {
      "/api": {
        // Docker: VITE_PROXY_TARGET=http://backend:8000 (Docker internal DNS)
        // Local:  falls back to 127.0.0.1:8000
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
