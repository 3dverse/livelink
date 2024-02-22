//------------------------------------------------------------------------------
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonOptions = {
  entryPoints: ["./app.ts"],
  outdir: "public/dist",
  bundle: true,
  platform: "browser",
  sourcemap: true,
};

//------------------------------------------------------------------------------
esbuild.build({ ...commonOptions, format: "cjs" });
esbuild.build({
  ...commonOptions,
  format: "esm",
  outExtension: { ".js": ".mjs" },
});
