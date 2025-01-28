import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        host: "0.0.0.0",
    },
    plugins: [fileContentPlugin(), react(), markdownLoaderPlugin()],
});

function markdownLoaderPlugin() {
    return {
        name: "markdown-loader",
        transform(src: string, id: string) {
            if (id.slice(-3) === ".md") {
                // For .md files, get the raw content
                return `export default ${JSON.stringify(src)};`;
            }
        },
    };
}

function fileContentPlugin() {
    const env = fs.readFileSync(".env", "utf-8");
    const token = env
        .split("\n")
        .find((line: string) => line.startsWith("VITE_PROD_PUBLIC_TOKEN="))
        .split("=")[1];

    return {
        name: "vite-plugin-file-content",
        transform(src: string, id: string) {
            // Only process files that are not from node_modules or certain other exclusions
            if (id.includes("node_modules")) {
                return;
            }

            if (!id.endsWith(".tsx")) {
                return;
            }

            // Inject the content of the current file into the global environment variable
            const fileContent = patchCodeSample(fs.readFileSync(id, "utf-8"), token);

            // Use `process.env` to inject the file content into the build process
            return {
                code: `
                    const fileContent = ${JSON.stringify(fileContent)};
                    import.meta.VITE_FILE_NAME = "${id}";
                    import.meta.VITE_FILE_CONTENT = fileContent;
                    ${src}
                `,
            };
        },
    };
}

function patchCodeSample(sourceCode: string, token: string): string {
    // Remove the 'export default' statement and its associated exported code
    const viteImportToken = "import.meta.env.VITE_PROD_PUBLIC_TOKEN";
    return sourceCode
        .replace(
            /(\s\/\/\-+)?\sexport\s+default\s+{[^]*?};\n|(\s\/\/\-+)?\simport\s+{[^}]*}\s+from\s+["'][^"']*SamplePlayer["'];\n/g,
            "",
        )
        .replace(viteImportToken, `"${token}"`);
}
