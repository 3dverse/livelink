//------------------------------------------------------------------------------
import type { LivelinkConnectionStage } from "@3dverse/livelink";
import React from "react";
import { Rocket3dverse } from "../../components-common/Rocket3dverse";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const stageMessages: Record<LivelinkConnectionStage, string> = {
    initializing: "Initializing...",
    "finding-session": "Looking for available sessions...",
    "creating-session": "Creating new session...",
    "registering-client": "Registering client...",
    connecting: "Connecting to server...",
    configuring: "Configuring client...",
    ready: "Almost ready...",
};

//------------------------------------------------------------------------------
export const LoadingOverlay = ({ stage }: { stage: LivelinkConnectionStage }) => {
    return (
        <div className={`${styles.container} ${styles.glowEffectStyle} livelink-react-ui-component`}>
            <div className={styles.logoContainer}>
                <Rocket3dverse />
            </div>
            <div className={styles.loaderProgressBarIndeterminateContainer} role="progressbar">
                <div className={styles.loaderProgressBarIndeterminateTrack} />
            </div>
            {stage && <p className={styles.label}>{stageMessages[stage] || "Loading..."}</p>}
        </div>
    );
};
