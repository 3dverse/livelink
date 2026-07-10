import { defineConfig } from "vitest/config";
import pkg from "./package.json";

export default defineConfig({
    define: {
        PACKAGE_NAME: JSON.stringify(pkg.name),
        LIVELINK_VERSION: JSON.stringify(pkg.version),
        API_HOSTNAME: JSON.stringify("api.3dverse.com"),
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
