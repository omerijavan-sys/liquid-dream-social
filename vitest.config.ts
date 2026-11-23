import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  define: { __WEB_BUILD__: JSON.stringify("test") },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost:8080/" },
    },
    globals: true,
    env: { VITE_SUPABASE_URL: "http://localhost:54321", VITE_SUPABASE_PUBLISHABLE_KEY: "test-key" },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
