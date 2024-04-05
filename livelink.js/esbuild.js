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
  mainFields: ["module", "main"],
  // TODO: not sure what we want to do here. If platform is neutral then it may
  // be usable from node or the browser, but for the browser we probably have to
  // add to the upper "mainFields" option and set the "browser" field into the
  // package.json. If it's intended to be used only from browser then set the
  // "platform" option to "browser". see https://esbuild.github.io/api/#main-fields
  // platform: "browser",
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
