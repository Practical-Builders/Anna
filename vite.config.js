import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load all .env variables server-side (no VITE_ prefix needed)
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: "src",
    build: {
      outDir: "../dist",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        // Browser calls /api/anthropic → Vite forwards to api.anthropic.com
        // This avoids CORS entirely and keeps the API key off the client bundle
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, "/v1/messages"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("x-api-key", env.ANTHROPIC_API_KEY);
              proxyReq.setHeader("anthropic-version", "2023-06-01");
              proxyReq.setHeader("anthropic-dangerous-direct-browser-access", "true");
            });
          },
        },
      },
    },
  };
});
