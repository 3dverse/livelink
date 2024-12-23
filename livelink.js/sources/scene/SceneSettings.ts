//------------------------------------------------------------------------------
import { SettingsBaseType, SettingType } from "@3dverse/livelink.core";

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
    _init(settings: SettingsBaseType): void {
        for (const key in settings) {
            this[key as SettingType] = settings[key as SettingType];
        }
    }
}
