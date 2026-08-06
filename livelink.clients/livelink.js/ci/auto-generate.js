//------------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

//------------------------------------------------------------------------------
const nodeModulePath = process.argv[2] || "../../node_modules";
const templateFolder = process.argv[3] || ".";
const outputFolder = process.argv[4] || "../_prebuild";

//------------------------------------------------------------------------------
const componentTypeDeclarationFile = path.join(
    nodeModulePath,
    "@3dverse/livelink.core/dist/_prebuild/engine_types/components.d.ts",
);

//------------------------------------------------------------------------------
const pascalCaseToSnakeCase = str =>
    str.slice(0, 1).toLowerCase() +
    str
        .slice(1)
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase();

//------------------------------------------------------------------------------
// Browser flavour: proxied getters (nested mutations flag the entity dirty through the shared base).
// The setter must be re-declared alongside the getter: an accessor override replaces the whole
// get/set pair, so a getter-only override would drop the base setter (read-only type, runtime TypeError).
function generateComponentAccessors(componentName, componentType, componentDescription) {
    return `    ${componentDescription}
    override get ${componentName}() : Components.${componentType} | undefined {
        return this.#component_proxies.wrap({entity: this, component_name: "${componentName}", value: super.${componentName}, ComponentHandler});
    }

    override set ${componentName}(value: Partial<Components.${componentType}> | DefaultValue | undefined) {
        this._setComponentValue({component_name: "${componentName}", value});
    }`;
}

//------------------------------------------------------------------------------
function generateEntityComponentsProxy() {
    const program = ts.createProgram([componentTypeDeclarationFile], {});
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(componentTypeDeclarationFile);

    const exportSymbol = checker.getSymbolAtLocation(sourceFile?.getChildAt(0));
    const exports = checker.getExportsAndPropertiesOfModule(exportSymbol || sourceFile.symbol);

    const componentExports = exports.filter(
        symbol => symbol.name !== "Euid" && symbol.name !== "ScriptElement" && symbol.name !== "LocalTransform",
    );

    const componentAttributes = componentExports.map(symbol => {
        const declaration = symbol.declarations[0];
        const jsDoc = declaration.jsDoc.find(jsDoc => jsDoc.comment?.length > 0);

        const name = pascalCaseToSnakeCase(symbol.name);
        const type = symbol.name;
        const comment = jsDoc?.getText().replace(/\n/g, "\n    ") || "";

        return generateComponentAccessors(name, type, comment);
    });

    //--------------------------------------------------------------------------
    applyTemplate("EntityComponentsProxy.template.ts", path.join("EntityComponentsProxy.ts"), {
        componentAttributes: componentAttributes.join("\n\n"),
        componentNames:
            componentExports.map(symbol => `        "${pascalCaseToSnakeCase(symbol.name)}"`).join(",\n") + ",",
    });
}

//------------------------------------------------------------------------------
function applyTemplate(templateFileName, outputSchemaName, dictionnary) {
    console.log("Generating", outputSchemaName);

    let template = fs.readFileSync(path.join(templateFolder, templateFileName), "utf8");
    for (const entryName in dictionnary) {
        template = template.replaceAll("{{" + entryName + "}}", dictionnary[entryName]);
    }

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder);
    }

    fs.writeFileSync(path.join(outputFolder, outputSchemaName), template);
}

//------------------------------------------------------------------------------
generateEntityComponentsProxy();
