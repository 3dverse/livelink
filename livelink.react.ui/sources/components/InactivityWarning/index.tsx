//------------------------------------------------------------------------------
import React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Livelink } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { InactivityWarningBadge } from "./InactivityWarningBadge";
import { Provider } from "../../chakra/Provider";

//------------------------------------------------------------------------------
const delayBeforeDisconnnect = 60; // seconds

//------------------------------------------------------------------------------
export const InactivityWarning = ({ instance }: { instance: Livelink | null }) => {
    //------------------------------------------------------------------------------
    const [isVisible, setVisibility] = useState<boolean>(false);
    const [timeLeft, setTimeLeft] = useState<number>(delayBeforeDisconnnect);
    const animatedPathRef = useRef<SVGPathElement>(null);
    const animatedOverlayRef = useRef<HTMLDivElement>(null);

    //------------------------------------------------------------------------------
    const onWarningVisible = () => {
        setVisibility(true);
    };

    //------------------------------------------------------------------------------
    const onDisconnect = useCallback(() => {
        setVisibility(false);
    }, []);

    //------------------------------------------------------------------------------
    const onActivityReset = () => {
        if (!instance) {
            console.error("No instance");
            return;
        }
        instance.activity_watcher.reset();

        if (isVisible) {
            setVisibility(false);
        }
    };

    //------------------------------------------------------------------------------
    useEffect(() => {
        if (!instance) return;

        instance.activity_watcher.addEventListener("on-warning", onWarningVisible);
        instance.session.addEventListener("on-disconnected", onDisconnect);

        return () => {
            instance.activity_watcher.removeEventListener("on-warning", onWarningVisible);
            instance.session.removeEventListener("on-disconnected", onDisconnect);
        };
    }, [instance, onDisconnect]);

    //------------------------------------------------------------------------------
    useEffect(() => {
        let timer: number;
        if (isVisible) {
            // Reset timer
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

            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [isVisible]);

    //------------------------------------------------------------------------------
    useEffect(() => {
        if (timeLeft === 0) {
            onDisconnect();
        }
    }, [timeLeft, onDisconnect]);

    //------------------------------------------------------------------------------
    if (!isVisible) return null;
    return (
        <Provider>
            <InactivityWarningBadge
                timeLeft={timeLeft}
                onActivityReset={onActivityReset}
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
