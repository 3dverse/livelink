//------------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";

//------------------------------------------------------------------------------
import type { BodyPosture } from "./bodyRig";

//------------------------------------------------------------------------------
/**
 * The posture of the robot, eased toward the target posture over `durationMs`. A new target stops the transition
 * running, if any, and starts from where it was.
 */
export function usePostureTransition(
    initialPosture: BodyPosture,
    durationMs: number,
): { posture: BodyPosture; transitionTo: (targetPosture: BodyPosture) => void } {
    const [posture, setPosture] = useState(initialPosture);
    const frameIdRef = useRef<number | null>(null);

    const postureRef = useRef(posture);
    useEffect(() => {
        postureRef.current = posture;
    });

    const stopTransition = useCallback((): void => {
        if (frameIdRef.current !== null) {
            cancelAnimationFrame(frameIdRef.current);
            frameIdRef.current = null;
        }
    }, []);
    useEffect(() => stopTransition, [stopTransition]);

    const transitionTo = useCallback(
        (targetPosture: BodyPosture): void => {
            stopTransition();
            const startPosture = postureRef.current;
            const startTime = performance.now();
            const step = (time: number): void => {
                const progress = durationMs > 0 ? Math.min(1, (time - startTime) / durationMs) : 1;
                setPosture(interpolatePosture(startPosture, targetPosture, easeInOutCubic(progress)));
                frameIdRef.current = progress < 1 ? requestAnimationFrame(step) : null;
            };
            frameIdRef.current = requestAnimationFrame(step);
        },
        [durationMs, stopTransition],
    );

    return { posture, transitionTo };
}

function interpolatePosture(from: BodyPosture, to: BodyPosture, t: number): BodyPosture {
    const lerp = (key: keyof BodyPosture): number => from[key] + (to[key] - from[key]) * t;
    return {
        pelvisTiltDeg: lerp("pelvisTiltDeg"),
        lumbarFlexionDeg: lerp("lumbarFlexionDeg"),
        thoracicFlexionDeg: lerp("thoracicFlexionDeg"),
        kneeFlexionDeg: lerp("kneeFlexionDeg"),
        twistDeg: lerp("twistDeg"),
    };
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
