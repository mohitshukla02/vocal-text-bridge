import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Single source of truth: read the backend port from the project-root .env
  // so the proxy always follows whatever the server is using.
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "5075";

  return {
    server: {
      host: "::",
      port: 8080,
      strictPort: true, // electron:dev waits on this exact port; fail loudly instead of silently drifting
      proxy: {
        "/api": `http://localhost:${apiPort}`,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
