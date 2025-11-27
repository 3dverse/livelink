//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import type { SceneInfo } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { LivelinkContext } from "../components/core/Livelink";

/**
 * Provides the scene info.
 *
 * @category Hooks
 */
export function useSceneInfo(): {
    isPending: boolean;
    sceneInfo: SceneInfo | null;
} {
    const { instance } = useContext(LivelinkContext);

    const [sceneInfo, setSceneInfo] = useState<SceneInfo | null>(null);
    const [isPending, setIsPending] = useState<boolean>(true);

    useEffect(() => {
        if (!instance) {
            return;
        }

        const fetchSettings = async (): Promise<void> => {
            const sceneInfo = await instance.scene.getInfo();
            setSceneInfo(sceneInfo);
            setIsPending(false);
        };

        fetchSettings();

        return (): void => {
            setSceneInfo(null);
            setIsPending(true);
        };
    }, [instance]);

    return { isPending, sceneInfo };
}
