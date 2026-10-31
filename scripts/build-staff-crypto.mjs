import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild-wasm";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await esbuild.initialize();
await esbuild.build({
  absWorkingDir: projectRoot,
  entryPoints: ["scripts/staff-crypto-entry.mjs"],
  outfile: "apps-script/StaffCrypto.gs",
  bundle: true,
  format: "iife",
  globalName: "LittleLandStaffCrypto",
  platform: "neutral",
  target: "es2020",
  minify: true,
  legalComments: "inline",
  banner: {
    js: "/* Generated from scripts/staff-crypto-entry.mjs; run pnpm build:staff-crypto. Do not edit manually. */",
  },
  logLevel: "warning",
});

const output = path.join(projectRoot, "apps-script/StaffCrypto.gs");
const bytes = (await stat(output)).size;
console.log(`Built apps-script/StaffCrypto.gs (${bytes} bytes).`);
