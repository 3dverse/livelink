//------------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");

//------------------------------------------------------------------------------
const ftlSchemaFolder = process.argv[2] || "../../ftl-schemas";
const templateFolder = process.argv[3] || ".";
const outputFolder = process.argv[4] || "../_prebuild/types";

//------------------------------------------------------------------------------
const componentFolder = path.join(ftlSchemaFolder, "components");

//------------------------------------------------------------------------------
function titlelize(str) {
    return str
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .map(word => word.replace(/(\d)([a-z])/g, (match, digit, letter) => digit + letter.toUpperCase()))
        .join("");
}

//------------------------------------------------------------------------------
function generateEntityBase() {
    //--------------------------------------------------------------------------
    const componentFiles = fs.readdirSync(componentFolder);
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

        const titlizedComponentClass = titlelize(component.class);

        //----------------------------------------------------------------------
        componentAttributes.push(`    /**
     * ${component.description}
     */
    ${component.class}?: Components.${titlizedComponentClass};`);
    }

    //--------------------------------------------------------------------------
    applyTemplate("EntityBase.template.ts", path.join("EntityBase.ts"), {
        componentAttributes: componentAttributes.join("\n\n"),
    });
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
generateEntityBase();
