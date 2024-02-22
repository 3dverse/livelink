//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonOptions = {
  entryPoints: ["./sources/index.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  sourcemap: true,
};

//------------------------------------------------------------------------------
esbuild.build({ ...commonOptions, format: "cjs" });
esbuild.build({
  ...commonOptions,
  format: "esm",
  outExtension: { ".js": ".mjs" },
});
