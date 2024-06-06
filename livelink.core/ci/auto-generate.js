//------------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const XXH = require("xxhashjs");

//------------------------------------------------------------------------------
const ftlSchemaFolder = process.argv[2] || "../../ftl-schemas";
const templateFolder = process.argv[3] || ".";
const outputFolder = process.argv[4] || process.cwd();

//------------------------------------------------------------------------------
const componentFolder = path.join(ftlSchemaFolder, "components");
const assetFolder = path.join(ftlSchemaFolder, "assets");

//------------------------------------------------------------------------------
function componentTypeToTypeScriptType(type) {
    const arrayMatch = type.match(/array<(.+)>/);
    if (arrayMatch) {
        return `Array<${componentTypeToTypeScriptType(arrayMatch[1])}>`;
    }

    const mapMatch = type.match(/map<(.+)>/);
    if (mapMatch) {
        return `Record<UUID, ${componentTypeToTypeScriptType(mapMatch[1])}>`;
    }

    switch (type) {
        case "int":
            return "Int32";
        case "float":
            return "Float";
        case "double":
            return "Double";

        case "int8_t":
        case "int16_t":
        case "int32_t":
            return type.slice(0, 1).toUpperCase() + type.slice(1, -2);

        case "uint8_t":
        case "uint16_t":
        case "uint32_t":
            return type.slice(0, 2).toUpperCase() + type.slice(2, -2);

        case "bool":
            return "boolean";

        case "vec2":
        case "vec3":
        case "vec4":
            return type.slice(0, 1).toUpperCase() + type.slice(1);

        case "ivec2":
        case "ivec3":
        case "ivec4":
            return type.slice(0, 1).toUpperCase() + type.slice(1) + "i";

        case "quaternion":
            return "Quat";

        case "json":
            return "Record<string, unknown>";
        case "script_element":
            return "ScriptElement";

        case "uuid":
            return "UUID";

        case "entity_ref":
            return "EntityRef";
    }

    if (type.endsWith("_ref")) {
        return `AssetRef<Assets.${titlelize(type.replace("_ref", "").replace("texture2d", "texture"))}>`;
    }

    return type;
}

//------------------------------------------------------------------------------
function titlelize(str) {
    return str
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .map(word => word.replace(/(\d)([a-z])/g, (match, digit, letter) => digit + letter.toUpperCase()))
        .join("");
}

//------------------------------------------------------------------------------
function generateComponentsSchemas() {
    const assetFiles = fs.readdirSync(assetFolder);
    const assetTypes = assetFiles
        .filter(assetFileName => !assetFileName.startsWith("common"))
        .map(assetFileName => titlelize(assetFileName.replace(".asset.schema.json", "")));

    //--------------------------------------------------------------------------
    const componentFiles = fs.readdirSync(componentFolder);
    const componentClasses = [];
    const componentTypes = [];
    const componentAttributes = [];

    for (const assetFileName of componentFiles) {
        const fileContent = fs.readFileSync(path.join(componentFolder, assetFileName), "utf-8");
        const component = JSON.parse(fileContent);

        if (component.class === "euid") {
            continue;
        }

        if (component.mods.includes("transient")) {
            continue;
        }

        const attributes = component.attributes.filter(attribute => !attribute.mods.includes("transient"));

        componentClasses.push(component.class);

        const titlizedComponentClass = titlelize(component.class);

        //----------------------------------------------------------------------
        componentTypes.push(`/**
* ${component.description}
*/
export type ${titlizedComponentClass} = Partial<{
    ${attributes
        .map(
            attribute => `/**
     * ${attribute.description}
     */
    ${attribute.name}: ${componentTypeToTypeScriptType(attribute.type)};`,
        )
        .join("\n    ")}
}>;`);

        componentAttributes.push(`    /**
     * ${component.description}
     */
    ${component.class}?: Components.${titlizedComponentClass};`);
    }

    //--------------------------------------------------------------------------
    applyTemplate("components.template.ts", path.join("components.ts"), {
        componentTypes: componentTypes.join("\n\n"),
        componentHashes: componentClasses
            .map(className => `${className} = ${parseInt(XXH.h32().update(className).digest().toString())},`)
            .join("\n    "),
        assetTypes: assetTypes.join(", "),
    });

    //--------------------------------------------------------------------------
    applyTemplate("EntityBase.template.ts", path.join("EntityBase.ts"), {
        componentAttributes: componentAttributes.join("\n\n"),
    });

    //--------------------------------------------------------------------------
    const assetTypeFile = assetTypes.map(assetType => `export type ${assetType} = {};`).join("\n") + "\n";
    fs.writeFileSync(path.join(outputFolder, "assets.ts"), assetTypeFile);
}

//------------------------------------------------------------------------------
function applyTemplate(templateFileName, outputSchemaName, dictionnary) {
    console.log("Generating", outputSchemaName);

    let template = fs.readFileSync(path.join(templateFolder, templateFileName), "utf8");
    for (const entryName in dictionnary) {
        template = template.replaceAll("{{" + entryName + "}}", dictionnary[entryName]);
    }

    fs.writeFileSync(path.join(outputFolder, outputSchemaName), template);
}

//------------------------------------------------------------------------------
generateComponentsSchemas();
