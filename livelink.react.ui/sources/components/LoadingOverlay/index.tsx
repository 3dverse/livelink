//------------------------------------------------------------------------------
import React from "react";
import { Rocket3dverse } from "../../components-common/Rocket3dverse";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
export const LoadingOverlay = ({ stage = "Connecting to 3dverse..." }: { stage?: string }) => {
    return (
        <div className={`${styles.container} ${styles.glowEffectStyle} livelink-react-ui-component`}>
            <div className={styles.logoContainer}>
                <Rocket3dverse />
            </div>
            <div className={styles.loaderProgressBarIndeterminateContainer} role="progressbar">
                <div className={styles.loaderProgressBarIndeterminateTrack} />
            </div>
            {stage && <p className={styles.label}>{stage}</p>}
        </div>
    );
};
