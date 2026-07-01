import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw || raw === "/") {
    return "/";
  }

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return `${withLeadingSlash.replace(/\/+$/, "")}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.APP_BASE_PATH),
    plugins: [react()],
    server: {
      port: 5274,
      strictPort: true
    }
  };
});
