/* eslint-disable */

//------------------------------------------------------------------------------
const esbuild = require("esbuild");
const pkg = require("./package.json");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    platform: "browser",
    packages: "bundle",
    external: [...Object.keys(pkg.peerDependencies)],
    sourcemap: true,
    define: {
        LIVELINK_REACT_UI_VERSION: `"${pkg.version}"`,
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
        const ctx = await esbuild.context({ ...commonBuildOptions, ...buildOptions[0], ...devBuildOptions });
        await ctx.watch();
        return;
    }

    for (const options of buildOptions) {
        console.log(`Building ${options.format}...`);
        await esbuild.build({ ...commonBuildOptions, ...options, ...prodBuildOptions });
    }
})();
