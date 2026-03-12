import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/run.ts"],
  publint: true,
  dts: true,
});
