//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    minify: true,
    platform: "neutral",
    mainFields: ["browser", "module", "main"],
    external: [...Object.keys(pkg.peerDependencies || {})],
    sourcemap: true,
    define: {
        API_HOSTNAME: `"api.3dverse.com"`,
        EDITOR_URL: `"wss://api.3dverse.com/editor-backend"`,
    },
};

//------------------------------------------------------------------------------
const buildOptions = [
    {
        format: "esm",
        outExtension: { ".js": ".mjs" },
    },
    {
        format: "cjs",
        outExtension: { ".js": ".cjs" },
    },
];

//------------------------------------------------------------------------------
(async () => {
    if (process.argv.includes("dev")) {
        for (const options of buildOptions) {
            const devBuildOptions = {
                ...commonBuildOptions,
                ...options,
            };

            const ctx = await esbuild.context(devBuildOptions);
            await ctx.watch();
        }

        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options });
    }
})();
