/** @type {Partial<import('typedoc').TypeDocOptions>} */
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
};

export default config;
