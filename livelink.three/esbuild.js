//------------------------------------------------------------------------------
const pkg = require("./package.json");
const esbuild = require("esbuild");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts", "./sources/react/index.ts"],
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
    minify: false,
};

const prodBuildOptions = {
    minify: true,
    pure: ["console.debug"],
};

//------------------------------------------------------------------------------
(async () => {
    if (process.argv.includes("dev")) {
        for (const buildOption of buildOptions) {
            const options = {
                ...commonBuildOptions,
                ...buildOption,
                ...devBuildOptions,
            };

            const ctx = await esbuild.context(options);
            await ctx.watch();
        }

        return;
    }

    for (const buildOption of buildOptions) {
        console.log(`Building ${buildOption.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...buildOption, ...prodBuildOptions });
    }
})();
