//------------------------------------------------------------------------------
import { useContext, useEffect, useReducer, useState } from "react";

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
    sceneSettings: Readonly<SceneSettingsRecord> | null;
} {
    const { instance } = useContext(LivelinkContext);

    const [sceneSettings, setSceneSettings] = useState<Readonly<SceneSettingsRecord> | null>(null);
    const [isPending, setIsPending] = useState<boolean>(true);
    const [, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const fetchSettings = async (): Promise<void> => {
            const sceneSettings = await instance.scene.getSettings();
            console.debug("----- Fetched scene settings:", sceneSettings);
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

        const onSettingsUpdated = async (_: SceneSettingsUpdatedEvent): Promise<void> => {
            forceUpdate();
        };

        instance.scene.addEventListener("on-scene-settings-updated", onSettingsUpdated);
        return (): void => {
            instance.scene.removeEventListener("on-scene-settings-updated", onSettingsUpdated);
        };
    }, [instance, sceneSettings]);

    return { isPending, sceneSettings };
}
