//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");
const httpServer = require("http-server");

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
        await ctx.serve({ servedir: "dist" }).then(server => {
            httpServer
                .createServer({
                    root: "dist",
                    cors: true,
                    proxy: `http://localhost:${server.port}`,
                    cache: -1,
                })
                .listen(3000);
        });
    } else {
        await ctx.rebuild();
        ctx.dispose();
    }
})();
