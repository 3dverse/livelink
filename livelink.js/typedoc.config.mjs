/** @type {Partial<import('typedoc').TypeDocOptions>} */
import { OptionDefaults } from "typedoc";

const config = {
    entryPoints: ["sources/index.ts"],
    entryPointStrategy: "resolve",
    out: "docs",
    includeVersion: true,
    excludeCategories: [],
    //defaultCategory: "Other",
    categoryOrder: ["Main", "Session", "Scene", "Streaming", "Rendering", "Inputs"],
    excludeInternal: true,
    sort: ["kind", "source-order"],
    plugin: ["typedoc-plugin-mermaid", "typedoc-plugin-no-inherit"],
    inheritNone: true,
    categorizeByGroup: false,
    navigation: {
        includeCategories: true,
        includeGroups: true,
    },

    modifierTags: [...OptionDefaults.modifierTags, "@noInheritDoc"],
    excludeTags: [...OptionDefaults.excludeTags, "@noInheritDoc"],

    sourceLinkTemplate: "https://github.com/3dverse/livelink/tree/release/{path}#L{line}",
};

export default config;
