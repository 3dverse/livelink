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
        sourcemap: true,
        outExtension: { ".js": ".mjs" },
    });

    if (process.argv.includes("dev")) {
        await ctx.watch();
        await ctx.serve({
            port: 3000,
            servedir: "dist",
        });
    } else {
        await ctx.rebuild();
        ctx.dispose();
    }
})();
