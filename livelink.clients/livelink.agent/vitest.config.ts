import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import pkg from "./package.json";

export default defineConfig({
    define: {
        PACKAGE_NAME: JSON.stringify(pkg.name),
        LIVELINK_VERSION: JSON.stringify(pkg.version),
        API_HOSTNAME: JSON.stringify("api.3dverse.com"),
    },
    resolve: {
        alias: {
            // First match wins, so the _prebuild entry must precede the sources one.
            "@livelink.base/_prebuild": resolve(process.cwd(), "../livelink.base/_prebuild"),
            "@livelink.base": resolve(process.cwd(), "../livelink.base/sources"),
            // `node-opcua-client` is an optional peer this repository does not install, so the
            // OPC UA transport's lazy import is pointed at a fake that lets it be driven without a
            // server. Nothing else resolves it.
            "node-opcua-client": resolve(process.cwd(), "tests/fakes/node-opcua-client.ts"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
