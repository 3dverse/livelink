//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const localLivelinkCore = "http://localhost:3000/index.mjs";
const productionLivelinkCore = "https://storage.googleapis.com/livelink-prod/core/index.mjs";

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    minify: true,
    platform: "neutral",
    external: [...Object.keys(pkg.peerDependencies || {})],
    sourcemap: true,
    define: {
        LIVELINK_CORE_URL: `"${productionLivelinkCore}"`,
        API_HOSTNAME: `"api.3dverse.dev"`,
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
    define: {
        ...commonBuildOptions.define,
        LIVELINK_CORE_URL: `"${localLivelinkCore}"`,
    },
};

//------------------------------------------------------------------------------
(async () => {
    if (process.argv.includes("dev")) {
        const ctx = await esbuild.context(devBuildOptions);
        await ctx.watch();
        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options });
    }
})();
