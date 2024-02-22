//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonOptions = {
  entryPoints: ["./sources/index.ts"],
  outdir: "dist",
  bundle: true,
  minify: true,
  platform: "neutral",
  external: [...Object.keys(pkg.peerDependencies || {})],
  sourcemap: true,
};

//------------------------------------------------------------------------------
esbuild.build({ ...commonOptions, format: "cjs" });
esbuild.build({
  ...commonOptions,
  format: "esm",
  outExtension: { ".js": ".mjs" },
});
