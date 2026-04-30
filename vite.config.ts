import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// tanstackStart already bundles the router generator plugin internally,
// so @tanstack/router-plugin/vite is not needed separately.
export default defineConfig({
  plugins: [tsconfigPaths(), tanstackStart(), react()],
});
