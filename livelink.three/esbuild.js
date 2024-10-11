//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    minify: true,
    platform: "browser",
    external: [...Object.keys(pkg.peerDependencies || {})],
    sourcemap: true,
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
        const ctx = await esbuild.context(devBuildOptions);
        await ctx.watch();
        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options });
    }
})();
