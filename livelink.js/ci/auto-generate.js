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
    "@3dverse/livelink.core/dist/_prebuild/types/components.d.ts",
);
const settingsTypeDeclarationFile = path.join(
    nodeModulePath,
    "@3dverse/livelink.core/dist/_prebuild/types/settings.d.ts",
);

//------------------------------------------------------------------------------
const pascalCaseToSnakeCase = str =>
    str.slice(0, 1).toLowerCase() +
    str
        .slice(1)
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase();

//------------------------------------------------------------------------------
function generateEntityBase() {
    const program = ts.createProgram([componentTypeDeclarationFile], {});
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(componentTypeDeclarationFile);

    const exportSymbol = checker.getSymbolAtLocation(sourceFile?.getChildAt(0));
    const exports = checker.getExportsAndPropertiesOfModule(exportSymbol || sourceFile.symbol);

    // For now filter only types with comments. This might not work for in the future.
    const componentExports = exports.filter(symbol =>
        symbol.declarations.some(declaration => declaration.jsDoc?.some(jsDoc => jsDoc.comment?.length > 0)),
    );

    const componentAttributes = componentExports.map(symbol => {
        const declaration = symbol.declarations[0];
        const jsDoc = declaration.jsDoc.find(jsDoc => jsDoc.comment?.length > 0);

        const name = pascalCaseToSnakeCase(symbol.name);
        const type = symbol.name;
        const comment = jsDoc.getText().replace(/\n/g, "\n    ");

        return `    ${comment}\n    ${name}?: Components.${type};`;
    });

    //--------------------------------------------------------------------------
    applyTemplate("EntityBase.template.ts", path.join("EntityBase.ts"), {
        componentAttributes: componentAttributes.join("\n\n"),
    });
}

// ----------------------------------------------------------------------------
function generateSettingsBase() {
    const program = ts.createProgram([settingsTypeDeclarationFile], {});
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(settingsTypeDeclarationFile);

    const exportSymbol = checker.getSymbolAtLocation(sourceFile?.getChildAt(0));
    const exports = checker.getExportsAndPropertiesOfModule(exportSymbol || sourceFile.symbol);

    // For now filter only types with comments. This might not work for in the future.
    const settingsType = exports
        .filter(symbol =>
            symbol.declarations.some(declaration => declaration.jsDoc?.some(jsDoc => jsDoc.comment?.length > 0)),
        )
        .map(symbol => symbol.name);

    //--------------------------------------------------------------------------
    applyTemplate("SettingsBase.template.ts", path.join("SettingsBase.ts"), {
        settingsAttributes: settingsType
            .map(type => `    ${pascalCaseToSnakeCase(type)}?: Settings.${type};`)
            .join("\n"),
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
generateEntityBase();
generateSettingsBase();
