import { Plugin } from "vite";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { readFileSync } from "fs";
import { join, basename } from "path";
import fs from "node:fs";
import traverseDefault from "@babel/traverse";
import sharp from "sharp";

//------------------------------------------------------------------------------
// Disclamer: This all happened in an LLM fever dream

const traverse = (traverseDefault as any).default || traverseDefault;

interface ExportDefaultToJsonOptions {
    include?: string | string[];
    imgDir?: string;
    codeOutDir?: string;
    metaOutDir?: string;
    imageOutDir?: string;
    imgQuality?: number;
}

export default function processSample(options: ExportDefaultToJsonOptions = {}): Plugin {
    const {
        include = "src/samples",
        codeOutDir = "code",
        metaOutDir = "meta",
        imageOutDir = "image",
        imgDir = "images",
        imgQuality = 80,
    } = options;
    const env = fs.readFileSync(".env", "utf-8");
    const token = env
        .split("\n")
        .find((line: string) => line.startsWith("VITE_PROD_PUBLIC_TOKEN="))!
        .split("=")[1];
    let projectRoot: string;

    return {
        name: "vite-plugin-export-default-to-json",

        configResolved(config) {
            projectRoot = config.root;
        },

        // Process files during transform phase
        async transform(code: string, id: string) {
            // Check if file matches the include pattern
            if (!id.endsWith(".tsx")) {
                return null;
            }

            // Simple pattern matching - you can use micromatch for more complex patterns
            const shouldProcess = Array.isArray(include)
                ? include.some(pattern => id.includes(pattern))
                : id.includes(include);

            if (!shouldProcess) {
                return null;
            }

            //------------------------------------------------------------------
            // Extract data
            try {
                // Parse the TypeScript code
                const ast = parse(code, {
                    sourceType: "module",
                    plugins: ["typescript", "jsx"],
                });

                let exportDefaultValue: any = null;

                // Traverse the AST to find export default
                traverse(ast, {
                    ExportDefaultDeclaration(path) {
                        const declaration = path.node.declaration;

                        // Handle object expressions: export default { ... }
                        if (t.isObjectExpression(declaration)) {
                            exportDefaultValue = evaluateObjectExpression(declaration);
                        }
                        // Handle array expressions: export default [...]
                        else if (t.isArrayExpression(declaration)) {
                            exportDefaultValue = evaluateArrayExpression(declaration);
                        }
                        // Handle identifiers: export default myData
                        else if (t.isIdentifier(declaration)) {
                            // Find the variable declaration
                            const binding = path.scope.getBinding(declaration.name);
                            if (binding && t.isVariableDeclarator(binding.path.node)) {
                                const init = binding.path.node.init;
                                if (t.isObjectExpression(init)) {
                                    exportDefaultValue = evaluateObjectExpression(init);
                                } else if (t.isArrayExpression(init)) {
                                    exportDefaultValue = evaluateArrayExpression(init);
                                }
                            }
                        }
                    },
                });

                const fileName = resolveSampleFileName(basename(id, ".ts").replace(".tsx", "").toLowerCase());

                //------------------------------------------------------------------
                // Save Code
                const fileContent = patchCodeSample(fs.readFileSync(id, "utf-8"), token);
                const codeFileName = `${fileName}.js`;
                const codeFilePath = join(codeOutDir, codeFileName);

                // Store for writeBundle phase
                this.emitFile({
                    type: "asset",
                    fileName: codeFilePath,
                    source: fileContent,
                });

                //--------------------------------------------------------------
                // Save Image
                let imageFilePath;
                if (exportDefaultValue.image) {
                    const buffer = readFileSync(join(projectRoot, imgDir, exportDefaultValue.image));
                    const webpBuffer = await sharp(buffer).webp({ quality: imgQuality }).toBuffer();
                    imageFilePath = join(imageOutDir, `${fileName}.webp`);

                    // Write output file
                    this.emitFile({
                        type: "asset",
                        fileName: imageFilePath,
                        source: webpBuffer,
                    });
                }

                //--------------------------------------------------------------
                // Save Meta
                if (exportDefaultValue !== null) {
                    const meta = { ...exportDefaultValue };
                    // cleanup
                    delete meta.element;
                    delete meta.code;
                    delete meta.path;

                    meta.codePath = codeFilePath;
                    if (imageFilePath) {
                        meta.imagePath = imageFilePath;
                    }

                    // Generate output filename
                    const jsonFileName = `${fileName}.json`;

                    // Store for writeBundle phase
                    this.emitFile({
                        type: "asset",
                        fileName: `${metaOutDir}/${jsonFileName}`,
                        source: JSON.stringify(meta, null, 2),
                    });
                }
            } catch (error) {
                console.error(`❌ Error processing ${id}:`, error);
            }
            return null;
        },
    };
}

// Helper function to evaluate object expressions
function evaluateObjectExpression(node: t.ObjectExpression): any {
    const obj: any = {};

    node.properties.forEach(prop => {
        if (t.isObjectProperty(prop) && !prop.computed) {
            const key = t.isIdentifier(prop.key) ? prop.key.name : String((prop.key as any).value);
            obj[key] = evaluateNode(prop.value);
        } else if (t.isSpreadElement(prop)) {
            // Handle spread operator (basic support)
            const spreadValue = evaluateNode(prop.argument);
            Object.assign(obj, spreadValue);
        }
    });

    return obj;
}

// Helper function to evaluate array expressions
function evaluateArrayExpression(node: t.ArrayExpression): any[] {
    return node.elements.map(el => (el ? evaluateNode(el) : null));
}

// Helper function to evaluate different node types
function evaluateNode(node: t.Node): any {
    if (t.isStringLiteral(node)) {
        return node.value;
    } else if (t.isNumericLiteral(node)) {
        return node.value;
    } else if (t.isBooleanLiteral(node)) {
        return node.value;
    } else if (t.isNullLiteral(node)) {
        return null;
    } else if (t.isObjectExpression(node)) {
        return evaluateObjectExpression(node);
    } else if (t.isArrayExpression(node)) {
        return evaluateArrayExpression(node);
    } else if (t.isTemplateLiteral(node)) {
        // Basic template literal support (no interpolation)
        return node.quasis.map(q => q.value.cooked).join("");
    }

    // For complex expressions, return a placeholder
    return "[Complex Expression]";
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

//------------------------------------------------------------------------------
export function resolveSampleFileName(filename: string): string {
    return filename.substring(2);
}
