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
  alias: {
    "@livelink.core": "http://localhost:3000/livelink.core/dist/index.mjs",
  },
  sourcemap: true,
};

//------------------------------------------------------------------------------
esbuild.build({ ...commonOptions, format: "cjs" });
esbuild.build({
  ...commonOptions,
  format: "esm",
  outExtension: { ".js": ".mjs" },
});
