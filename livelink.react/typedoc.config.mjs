/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
    entryPoints: ["sources/index.ts"],
    entryPointStrategy: "resolve",
    out: "docs",
    includeVersion: true,
    excludeCategories: [],
    defaultCategory: "Other",
    categoryOrder: ["*", "Other"],
    excludeInternal: true,
    sort: ["kind", "source-order"],
    kindSortOrder: ["Variable", "Function"],

    categorizeByGroup: false,
    navigation: {
        includeCategories: true,
        includeGroups: false,
    },
    tsconfig: "tsconfig.json",

    markdownItOptions: {
        hidePageHeader: true,
        hideBreadcrumbs: true,
        hidePageTitle: true,
        useCodeBlocks: true,
        parametersFormat: "table",
    },
};

export default config;
