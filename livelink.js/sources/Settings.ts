import { SettingsBaseType, SettingType } from "@3dverse/livelink.core";
import { SettingsBase } from "../_prebuild/SettingsBase";

export class Settings extends SettingsBase {
    constructor() {
        super();
    }

    /**
     *
     */
    _init(settings: SettingsBaseType) {
        for (const key in settings) {
            this[key as SettingType] = settings[key as SettingType];
        }
    }
}
