/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
    entryPoints: ["sources/index.ts"],
    entryPointStrategy: "resolve",
    out: "docs",
    includeVersion: true,
    excludeCategories: [],
    defaultCategory: "Other",
    categoryOrder: ["*"],
    excludeInternal: true,

    categorizeByGroup: false,
    navigation: {
        includeCategories: true,
        includeGroups: false,
    },
};

export default config;
