//------------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import { Provider } from "../../chakra/Provider";

//------------------------------------------------------------------------------
import { InactivityWarningBadge } from "./InactivityWarningBadge";

//------------------------------------------------------------------------------
export const InactivityWarning = ({
    warningDuration,
    onActivityDetected,
}: {
    warningDuration: number;
    onActivityDetected: () => void;
}) => {
    //------------------------------------------------------------------------------
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const animatedPathRef = useRef<SVGPathElement>(null);
    const animatedOverlayRef = useRef<HTMLDivElement>(null);

    //------------------------------------------------------------------------------
    useEffect(() => {
        setTimeLeft(warningDuration);

        // Relaunch css animation
        const path = animatedPathRef.current;
        if (path) {
            path.style.animation = "none";
            path.getBBox();
            path.style.animation = `inactivity-timer-path ${warningDuration}s linear forwards`;
        }
        const overlay = animatedOverlayRef.current;
        if (overlay) {
            overlay.style.animation = "none";
            void overlay.offsetWidth;
            overlay.style.animation = `inactivity-timer-overlay ${warningDuration}s linear forwards`;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [warningDuration]);

    //------------------------------------------------------------------------------
    return (
        <Provider>
            <InactivityWarningBadge
                timeLeft={timeLeft}
                onActivityReset={onActivityDetected}
                animatedPathRef={animatedPathRef}
                animatedOverlayRef={animatedOverlayRef}
            />
            <style>
                {`
                    @keyframes inactivity-timer-overlay {
                        from {
                            opacity: 0;
                        }
                        to {
                            opacity: .9;
                        }
                    }
                    @keyframes inactivity-timer-path {
                        from {
                            stroke-dashoffset: 624;
                        }
                        to {
                            stroke-dashoffset: 1248;
                        }
                    }
                `}
            </style>
        </Provider>
    );
};
