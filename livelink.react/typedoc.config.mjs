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

    hidePageHeader: true,
    hideBreadcrumbs: true,
    hidePageTitle: true,
    useCodeBlocks: true,
    parametersFormat: "table",
    interfacePropertiesFormat: "table",
    indexFormat: "table",
    classPropertiesFormat: "table",
    enumMembersFormat: "table",
    propertyMembersFormat: "table",
    typeDeclarationFormat: "table",
    expandObjects: true,
    expandParameters: true,
    typeDeclarationVisibility: "verbose",
    tableColumnSettings: {
        hideDefaults: false,
        hideInherited: false,
        hideModifiers: false,
        hideOverrides: false,
        hideSources: true,
        hideValues: false,
        leftAlignHeaders: false,
    },
    sourceLinkTemplate: "https://github.com/3dverse/livelink/tree/release/{path}#L{line}",
};

export default config;
