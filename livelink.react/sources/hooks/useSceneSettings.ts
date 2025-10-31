//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { SceneSettingsRecord, SceneSettingsUpdatedEvent } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * Provides the current scene settings.
 *
 * @category Hooks
 */
export function useSceneSettings(): {
    isPending: boolean;
    sceneSettings: SceneSettingsRecord | null;
} {
    const { instance } = useContext(LivelinkContext);

    const [sceneSettings, setSceneSettings] = useState<SceneSettingsRecord | null>(null);
    const [isPending, setIsPending] = useState<boolean>(true);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const fetchSettings = async (): Promise<void> => {
            const sceneSettings = await instance.scene.getSettings();
            setSceneSettings(sceneSettings);
            setIsPending(false);
        };

        fetchSettings();

        return (): void => {
            setSceneSettings(null);
            setIsPending(true);
        };
    }, [instance]);

    useEffect(() => {
        if (!sceneSettings || !instance) {
            return;
        }

        const onSettingsUpdated = ({ updated_settings }: SceneSettingsUpdatedEvent): void => {
            for (const [key, value] of Object.entries(updated_settings)) {
                Object.assign(sceneSettings[key as keyof SceneSettingsRecord], value);
            }

            console.debug("----- Scene settings updated:", updated_settings);
            setSceneSettings({ ...sceneSettings });
        };

        instance.scene.addEventListener("on-scene-settings-updated", onSettingsUpdated);
        return (): void => {
            instance.scene.removeEventListener("on-scene-settings-updated", onSettingsUpdated);
        };
    }, [instance, sceneSettings]);

    return { isPending, sceneSettings };
}
