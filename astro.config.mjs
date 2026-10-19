// @ts-check
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://missingsemester.in",
  // The writing lives in its own building: blog.missingsemester.in
  trailingSlash: "always",
  build: {
    format: "directory",
  },
});
