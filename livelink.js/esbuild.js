//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
(async () => {
    const ctx = await esbuild.context({
        entryPoints: ["./sources/index.ts"],
        outdir: "dist",
        bundle: true,
        minify: true,
        platform: "neutral",
        external: [...Object.keys(pkg.peerDependencies || {})],
        alias: {
            "@livelink.core": "http://localhost:3000/index.mjs",
        },
        sourcemap: true,
        format: "esm",
        outExtension: { ".js": ".mjs" },
    });

    if (process.argv.includes("dev")) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        ctx.dispose();
    }
})();
