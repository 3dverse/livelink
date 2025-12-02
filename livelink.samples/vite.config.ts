import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import exportDefaultToJson from "./plugins/extractDefaultToJson";

// https://vitejs.dev/config/
export default defineConfig({
    base: "",
    server: {
        host: "0.0.0.0",
        https: fs.existsSync("ssl")
            ? {
                  cert: "./ssl/cert.crt",
                  key: "./ssl/key.pem",
              }
            : undefined,
    },
    plugins: [
        fileContentPlugin(),
        react(),
        markdownLoaderPlugin(),
        tailwindcss(),
        exportDefaultToJson({ include: "src/samples", outDir: "meta" }),
    ],
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
        .find((line: string) => line.startsWith("VITE_PROD_PUBLIC_TOKEN="))!
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
    const viteImportToken = "import.meta.env.VITE_PROD_PUBLIC_TOKEN";
    return (
        sourceCode
            // Remove the 'export default' statement as it only needed to config a sample page
            .replace(/(\s\/\/\-+)?\sexport\s+default\s+{[^]*?};\n/g, "")
            // Remove the 'import' statements using 'SamplePlayer' as it's a private component
            .replace(/(\s\/\/\-+)?\simport\s+{[^}]*}\s+from\s+["'][^"']*SamplePlayer["'];\n/g, "")
            // Remove the ConnectionErrorPanel prop from sample code since it's a private component
            .replace(/\s+ConnectionErrorPanel={DisconnectedModal}/g, "")
            // Replace the token with the actual token
            .replace(viteImportToken, `"${token}"`)
    );
}
