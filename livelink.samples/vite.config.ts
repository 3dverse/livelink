import { Plugin, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "path";
import sharp from "sharp";

// https://vitejs.dev/config/
export default defineConfig({
    base: "",
    server: {
        host: "0.0.0.0",
        allowedHosts: true,
        https: fs.existsSync("ssl")
            ? {
                  cert: "./ssl/cert.crt",
                  key: "./ssl/key.pem",
              }
            : undefined,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    // `node-opcua-client` is an optional, Node-only peer of `@3dverse/livelink-agent`, lazily
    // imported on a code path no browser sample takes. It's hoisted into the root node_modules by
    // npm workspaces, so without these it gets resolved and pulls ~90 Node packages into the bundle.
    optimizeDeps: {
        exclude: ["node-opcua-client"],
    },
    build: {
        rollupOptions: {
            external: ["node-opcua-client"],
        },
    },
    plugins: [fileContentPlugin(), react(), markdownLoaderPlugin(), tailwindcss()],
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

interface fileContentPluginOptions {
    outDir?: string;
    imgQuality?: number;
}

function fileContentPlugin(options?: fileContentPluginOptions): Plugin {
    const { outDir = "samples", imgQuality = 80 } = options || {};
    const env = fs.readFileSync(".env", "utf-8");
    const token = env
        .split("\n")
        .find((line: string) => line.startsWith("VITE_PROD_PUBLIC_TOKEN="))!
        .split("=")[1];

    return {
        name: "vite-plugin-file-content",
        async transform(src: string, id: string) {
            // Only process files that are not from node_modules or certain other exclusions
            if (id.includes("node_modules")) {
                return;
            }

            if (!id.endsWith("manifest.ts")) {
                return;
            }

            const sampleDir = id.replace("/manifest.ts", "");
            const sampleName = sampleDir.substring(sampleDir.lastIndexOf("/") + 3, sampleDir.length);
            const metaFile = id.replace("manifest.ts", "meta.json");
            const codeFile = id.replace("manifest.ts", "index.tsx");
            const metaContent = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
            const codeContent = patchCodeSample(fs.readFileSync(codeFile, "utf-8"), token);

            //------------------------------------------------------------------
            // Save code
            this.emitFile({
                type: "asset",
                fileName: path.join(outDir, `${sampleName}.tsx`),
                source: codeContent,
            });

            //--------------------------------------------------------------
            // Save Image
            let imageFilePath;
            if (metaContent.image) {
                const buffer = fs.readFileSync(path.join(sampleDir, metaContent.image));
                const webpBuffer = await sharp(buffer).webp({ quality: imgQuality }).toBuffer();
                const imageFile = `${sampleName}.webp`;
                imageFilePath = path.join(outDir, imageFile);

                // Write output file
                this.emitFile({
                    type: "asset",
                    fileName: imageFilePath,
                    source: webpBuffer,
                });

                metaContent.image = imageFile;
            }

            //------------------------------------------------------------------
            // Save Meta
            metaContent.name = sampleName;
            metaContent.gitUrl = resolveGitPath(codeFile);
            this.emitFile({
                type: "asset",
                fileName: path.join(outDir, `${sampleName}.json`),
                source: JSON.stringify(metaContent),
            });

            // Use `process.env` to inject the file content into the build process
            return {
                code: `
                    const fileContent = ${JSON.stringify(codeContent)};
                    import.meta.VITE_FILE_NAME = "${codeFile}";
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
            // Remove the 'import' statements using 'SamplePlayer' as it's a private component
            .replace(/(\s\/\/\-+)?\simport\s+{[^}]*}\s+from\s+["'][^"']*SamplePlayer["'];\n/g, "")
            // Remove the ConnectionErrorPanel prop from sample code since it's a private component
            .replace(/\s+ConnectionErrorPanel={DisconnectedModal}/g, "")
            // Replace the token with the actual token
            .replace(viteImportToken, `"${token}"`)
    );
}

//------------------------------------------------------------------------------
export function resolveGitPath(path: string): string {
    const relPath = path.substring(path.lastIndexOf("livelink.samples/"));
    return "https://github.com/3dverse/livelink/tree/release/" + relPath;
}
