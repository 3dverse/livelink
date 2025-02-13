/** @type {Partial<import('typedoc').TypeDocOptions>} */
import defaultConfig from './typedoc.config.mjs';

const config = {
    ...defaultConfig,

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
};

export default config;
