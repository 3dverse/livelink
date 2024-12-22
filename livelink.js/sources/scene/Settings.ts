import { SettingsBaseType, SettingType } from "@3dverse/livelink.core";
import { SettingsBase } from "../../_prebuild/SettingsBase";

/**
 * The settings of a scene.
 *
 * @category Scene
 */
export class Settings extends SettingsBase {
    /**
     * @internal
     */
    constructor() {
        super();
    }

    /**
     * @internal
     */
    _init(settings: SettingsBaseType) {
        for (const key in settings) {
            this[key as SettingType] = settings[key as SettingType];
        }
    }
}
