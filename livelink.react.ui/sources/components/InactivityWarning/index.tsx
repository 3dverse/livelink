//------------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import { Provider } from "../../chakra/Provider";

//------------------------------------------------------------------------------
import { InactivityWarningBadge } from "./InactivityWarningBadge";

//------------------------------------------------------------------------------
const delayBeforeDisconnnect = 60; // seconds

//------------------------------------------------------------------------------
export const InactivityWarning = ({ onActivityDetected }: { onActivityDetected: () => void }) => {
    //------------------------------------------------------------------------------
    const [timeLeft, setTimeLeft] = useState<number>(delayBeforeDisconnnect);
    const animatedPathRef = useRef<SVGPathElement>(null);
    const animatedOverlayRef = useRef<HTMLDivElement>(null);

    //------------------------------------------------------------------------------
    useEffect(() => {
        setTimeLeft(delayBeforeDisconnnect);

        // Relaunch css animation
        const path = animatedPathRef.current;
        if (path) {
            path.style.animation = "none";
            path.getBBox();
            path.style.animation = `inactivity-timer-path ${delayBeforeDisconnnect}s linear forwards`;
        }
        const overlay = animatedOverlayRef.current;
        if (overlay) {
            overlay.style.animation = "none";
            void overlay.offsetWidth;
            overlay.style.animation = `inactivity-timer-overlay ${delayBeforeDisconnnect}s linear forwards`;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

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
