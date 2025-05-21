/* eslint-disable */

//------------------------------------------------------------------------------
const esbuild = require("esbuild");
const pkg = require("./package.json");
const cssModulesPlugin = require("esbuild-css-modules-plugin");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    bundle: true,
    platform: "browser",
    packages: "bundle",
    external: [...Object.keys(pkg.peerDependencies)],
    sourcemap: true,
    metafile: true,
    define: {
        PACKAGE_NAME: `"${pkg.name}"`,
        LIVELINK_REACT_UI_VERSION: `"${pkg.version}"`,
    },
    target: "es2022",
    plugins: [
        cssModulesPlugin({
            inject: true,
        }),
    ],
};

//------------------------------------------------------------------------------
const buildOptions = [
    {
        format: "esm",
        outfile: "dist/index.mjs",
    },
    {
        format: "cjs",
        outfile: "dist/index.cjs",
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
