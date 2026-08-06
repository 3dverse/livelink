/** @type {Partial<import('typedoc').TypeDocOptions>} */
import { OptionDefaults } from "typedoc";

const config = {
    entryPoints: ["sources/index.ts"],
    entryPointStrategy: "resolve",
    out: "docs",
    includeVersion: true,
    excludeCategories: [],
    excludeExternals: true,
    externalPattern: ["**/threejs-math/**"],
    //defaultCategory: "Other",
    categoryOrder: [
        "Main",
        "Session",
        "Scene",
        "Streaming",
        "Camera",
        "Rendering Surfaces",
        "Rendering Contexts",
        "Inputs",
    ],
    excludeInternal: true,
    sort: ["kind", "source-order"],
    // Inherited members are documented by default so subclasses of the shared livelink.base
    // classes (Session, Scene, Entity, ...) expose the full inherited API. Classes extending
    // DOM/lib types (Event, Error, CameraControls) opt out individually with @noInheritDoc.
    plugin: ["typedoc-plugin-mermaid", "typedoc-plugin-no-inherit"],
    categorizeByGroup: false,
    navigation: {
        includeCategories: true,
        includeGroups: true,
    },

    // typedoc-plugin-no-inherit looks the tag up with comment.getTag(), which only searches
    // block tags, so @noInheritDoc must be registered as a block tag (not a modifier) and must
    // not be in excludeTags. The plugin strips the tag from the output itself.
    blockTags: [...OptionDefaults.blockTags, "@noInheritDoc"],

    sourceLinkTemplate: "https://github.com/3dverse/livelink/tree/release/{path}#L{line}",
};

export default config;
