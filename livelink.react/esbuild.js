//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
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
    minify: false,
};

const prodBuildOptions = {
    minify: true,
    pure: ["console.debug"],
};

//------------------------------------------------------------------------------
(async () => {
    if (process.argv.includes("dev")) {
        console.log("Watching for changes...", { ...commonBuildOptions, ...buildOptions[0], ...devBuildOptions });
        const ctx = await esbuild.context({ ...commonBuildOptions, ...buildOptions[0], ...devBuildOptions });
        await ctx.watch();
        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options, ...prodBuildOptions });
    }
})();
