//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { CanvasContext } from "../components/core/Canvas";
import { LivelinkContext } from "../components/core/Livelink";
import { useSceneSettings } from "./useSceneSettings";
import { PointOfViewSnapshotGrid, type PointOfViewTransform } from "./utils/PointOfViewSnapshotGrid";

export type { PointOfViewTransform } from "./utils/PointOfViewSnapshotGrid";

/**
 * @internal
 */
const DEFAULT_TILE_WIDTH = 320;

/**
 * @internal
 */
const DEFAULT_TILE_HEIGHT = 180;

/**
 * @internal
 */
const DEFAULT_MAX_SIMULTANEOUS_CAPTURES = 2;

/**
 * @experimental
 *
 * A hook that renders a small snapshot image for each given point of view, by driving temporary
 * cameras through an offscreen surface packed as a grid so several are captured at once.
 *
 * Waits for the scene to finish loading (see `Scene.waitForSceneLoaded`) before capturing
 * anything, so snapshots aren't taken of a still-streaming-in scene.
 *
 * Generic — deals only in plain camera transforms, not labels or entities — so it's reusable for
 * any point-of-view preview feature.
 *
 * Must be used from a component rendered inside a `<Canvas>`, so the offscreen surface can be
 * positioned to avoid overlapping the visible viewport.
 *
 * @param pointsOfView - The points of view to capture, in order.
 * @param options - Options controlling the size and batching of the capture.
 * @param options.tileWidth - The width in pixels of each snapshot. Default 320.
 * @param options.tileHeight - The height in pixels of each snapshot. Default 180.
 * @param options.maxSimultaneousCaptures - The maximum number of points of view captured at
 * once, in a single grid. Default 2.
 *
 * @returns The snapshots, as an array of data URLs in the same order as `pointsOfView`, `null`
 * for entries not captured yet, and a flag indicating if the capture is still in progress.
 *
 * @category Hooks
 */
export function usePointOfViewSnapshots(
    pointsOfView: Array<PointOfViewTransform>,
    options?: {
        tileWidth?: number;
        tileHeight?: number;
        maxSimultaneousCaptures?: number;
    },
): {
    isPending: boolean;
    images: Array<string | null>;
} {
    const tileWidth = options?.tileWidth ?? DEFAULT_TILE_WIDTH;
    const tileHeight = options?.tileHeight ?? DEFAULT_TILE_HEIGHT;
    const maxSimultaneousCaptures = options?.maxSimultaneousCaptures ?? DEFAULT_MAX_SIMULTANEOUS_CAPTURES;

    const { instance } = useContext(LivelinkContext);
    const { renderingSurface } = useContext(CanvasContext);
    const { sceneSettings } = useSceneSettings();

    const [images, setImages] = useState<Array<string | null>>([]);
    const [isPending, setIsPending] = useState(true);

    const pointsOfViewHash = JSON.stringify(pointsOfView);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || !sceneSettings || !renderingSurface || pointsOfView.length === 0) {
            return;
        }

        let cancelled = false;
        let grid: PointOfViewSnapshotGrid | null = null;

        setImages(new Array(pointsOfView.length).fill(null));
        setIsPending(true);

        // Waits for the scene to finish loading, then creates the grid, captures every point of
        // view page by page, and tears it down.
        const capture = async (): Promise<void> => {
            const sceneLoaded = await instance.scene.waitForSceneLoaded();
            if (cancelled || !sceneLoaded) {
                if (!cancelled) {
                    setIsPending(false);
                }
                return;
            }

            grid = await PointOfViewSnapshotGrid.create({
                instance,
                sceneSettings,
                renderingSurface,
                cellCount: Math.min(pointsOfView.length, maxSimultaneousCaptures),
                tileWidth,
                tileHeight,
            });

            if (cancelled) {
                await grid.dispose();
                return;
            }

            for (let pageStart = 0; pageStart < pointsOfView.length && !cancelled; pageStart += grid.cellCount) {
                const pageImages = await grid.captureFrame(pointsOfView.slice(pageStart, pageStart + grid.cellCount));
                if (cancelled) {
                    break;
                }

                setImages(prevImages => {
                    const nextImages = [...prevImages];
                    pageImages.forEach((image, i) => {
                        nextImages[pageStart + i] = image;
                    });
                    return nextImages;
                });
            }

            await grid.dispose();
            if (!cancelled) {
                setIsPending(false);
            }
        };

        capture();

        return (): void => {
            cancelled = true;
            grid?.cancel();
        };
    }, [instance, sceneSettings, renderingSurface, pointsOfViewHash, tileWidth, tileHeight, maxSimultaneousCaptures]);

    return { isPending, images };
}
