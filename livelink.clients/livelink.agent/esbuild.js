//------------------------------------------------------------------------------
const esbuild = require("esbuild");
const path = require("path");
const pkg = require("./package.json");

//------------------------------------------------------------------------------
const commonBuildOptions = {
    entryPoints: ["./sources/index.ts"],
    outdir: "dist",
    bundle: true,
    platform: "neutral",
    packages: "bundle",
    // Optional peer dependencies of the data module (lazily imported at runtime) and the node
    // builtins used by the file transport must not be bundled in.
    external: ["mqtt", "@azure/event-hubs", "ajv", "node-opcua-client", "node:*"],
    mainFields: ["browser", "module", "main"],
    sourcemap: true,
    alias: {
        // livelink.base is a shared source folder bundled in (not a package dependency).
        // Longest alias wins, so the _prebuild entry takes precedence over the sources one.
        "@livelink.base/_prebuild": path.resolve(__dirname, "../livelink.base/_prebuild"),
        "@livelink.base": path.resolve(__dirname, "../livelink.base/sources"),
    },
    define: {
        PACKAGE_NAME: `"${pkg.name}"`,
        LIVELINK_VERSION: `"${pkg.version}"`,
        API_HOSTNAME: `"api.3dverse.com"`,
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

// Not minified on purpose: this package is consumed by Node backends where minification saves
// nothing at runtime but wrecks debuggability. Minified, a single-line bundle makes consumers'
// stack frames land on `index.mjs:2:3426`, and even with the shipped source maps applied the
// column-crowded mappings resolve to the wrong line. keepNames additionally preserves class and
// function names so frames read `TransportRegistry.create` rather than `nt.create`.
const prodBuildOptions = {
    minify: false,
    keepNames: true,
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
