//------------------------------------------------------------------------------
import { useContext, useEffect, useState } from "react";

//------------------------------------------------------------------------------
import { CanvasContext } from "../components/core/Canvas";
import { LivelinkContext } from "../components/core/Livelink";
import { useSceneSettings } from "./useSceneSettings";
import { PointOfViewSnapshotGrid, type PointOfViewTransform } from "./utils/PointOfViewSnapshotGrid";
import { useKeyedCache } from "./utils/useKeyedCache";

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
 * @internal
 * A cache key scoped to just position/orientation, so unrelated fields a caller might have
 * attached to a point of view (e.g. a label's title) don't cause spurious re-captures.
 */
function hashPointOfView(pointOfView: PointOfViewTransform): string {
    return JSON.stringify([pointOfView.position, pointOfView.orientation]);
}

/**
 * @experimental
 *
 * A hook that renders a small snapshot image for each given point of view, by driving temporary
 * cameras through an offscreen surface packed as a grid so several are captured at once.
 *
 * Already-captured points of view are cached in memory (keyed by position/orientation) for the
 * life of the component, so only new or actually-changed points of view get re-captured.
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
    const maxSimultaneousCaptures = Math.max(1, options?.maxSimultaneousCaptures ?? DEFAULT_MAX_SIMULTANEOUS_CAPTURES);

    const { instance } = useContext(LivelinkContext);
    const { renderingSurface } = useContext(CanvasContext);
    const { sceneSettings } = useSceneSettings();

    const [images, setImages] = useState<Array<string | null>>([]);
    const [isPending, setIsPending] = useState(true);

    const cache = useKeyedCache<string>();

    const entries = pointsOfView.map((pointOfView, index) => ({
        pointOfView,
        hash: hashPointOfView(pointOfView),
        index,
    }));
    const hashesKey = JSON.stringify(entries.map(entry => entry.hash));

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!instance || !sceneSettings || !renderingSurface || entries.length === 0) {
            return;
        }

        cache.prune(entries.map(entry => entry.hash));
        setImages(entries.map(entry => cache.get(entry.hash) ?? null));

        const missing = entries.filter(entry => !cache.has(entry.hash));
        if (missing.length === 0) {
            setIsPending(false);
            return;
        }

        let cancelled = false;
        let grid: PointOfViewSnapshotGrid | null = null;

        setIsPending(true);

        // Waits for the scene to finish loading, then creates the grid, captures every missing
        // point of view page by page, and tears it down.
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
                cellCount: Math.min(missing.length, maxSimultaneousCaptures),
                tileWidth,
                tileHeight,
            });

            if (cancelled) {
                await grid.dispose();
                return;
            }

            for (let pageStart = 0; pageStart < missing.length && !cancelled; pageStart += grid.cellCount) {
                const page = missing.slice(pageStart, pageStart + grid.cellCount);
                const pageImages = await grid.captureFrame(page.map(entry => entry.pointOfView));
                if (cancelled) {
                    break;
                }

                page.forEach((entry, i) => {
                    if (pageImages[i]) {
                        cache.set(entry.hash, pageImages[i]);
                    }
                });

                setImages(prevImages => {
                    const nextImages = [...prevImages];
                    page.forEach((entry, i) => {
                        nextImages[entry.index] = pageImages[i];
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
    }, [instance, sceneSettings, renderingSurface, hashesKey, tileWidth, tileHeight, maxSimultaneousCaptures]);

    return { isPending, images };
}
