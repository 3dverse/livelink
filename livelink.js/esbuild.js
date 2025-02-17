/* eslint-disable */

//------------------------------------------------------------------------------
const esbuild = require("esbuild");
const pkg = require("./package.json");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    platform: "neutral",
    packages: "bundle",
    mainFields: ["browser", "module", "main"],
    sourcemap: true,
    define: {
        PACKAGE_NAME: `"${pkg.name}"`,
        LIVELINK_VERSION: `"${pkg.version}"`,
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
