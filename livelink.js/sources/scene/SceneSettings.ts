//------------------------------------------------------------------------------
import { SceneSettingsRecord, SceneSettingType } from "@3dverse/livelink.core";

//------------------------------------------------------------------------------
import { SettingsBase } from "../../_prebuild/SettingsBase";

/**
 * The scene settings.
 *
 * @category Scene
 */
export class SceneSettings extends SettingsBase {
    /**
     * @internal
     */
    constructor() {
        super();
    }

    /**
     * @internal
     */
    _init(settings: SceneSettingsRecord): void {
        for (const strKey in settings) {
            const key = strKey as SceneSettingType;
            this[key] = settings[key];
        }
    }
}
