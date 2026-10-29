import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: { target: "es2020" },
  server: { host: "127.0.0.1", port: 8462, strictPort: true },
});
