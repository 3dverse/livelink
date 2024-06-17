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
        API_HOSTNAME: `"api.3dverse.dev"`,
        //EDITOR_URL : `"wss://livelink.3dverse.com"`;
        EDITOR_URL: `"wss://api.3dverse.dev/editor-backend"`,
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
const devBuildOptions = {
    ...commonBuildOptions,
    ...buildOptions[0],
};

//------------------------------------------------------------------------------
(async () => {
    if (process.argv.includes("dev")) {
        const ctx = await esbuild.context(commonBuildOptions);
        await ctx.watch();
        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options });
    }
})();
