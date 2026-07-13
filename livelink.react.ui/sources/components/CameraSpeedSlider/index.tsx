//------------------------------------------------------------------------------
import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { RiTriangleFill } from "react-icons/ri";
import { CameraController, CameraControllerPresets } from "@3dverse/livelink";
import { useSceneInfo } from "@3dverse/livelink-react";

//------------------------------------------------------------------------------
import { Icon } from "../../components-common/Icon";
import styles from "./style.module.css";
import { DEFAULT_SPEEDS, computeDiagonalKm, generateSpeeds } from "./speeds";

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const CameraSpeedSlider = ({
    cameraController,
    orientation = "vertical",
    label,
    onChange,
}: {
    cameraController?: CameraController;
    orientation?: "vertical" | "horizontal";
    label?: string;
    onChange?: (speed: number) => void;
}) => {
    //--------------------------------------------------------------------------
    const [initialSlide, setInitialSlide] = useState(0);
    const swiperRef = useRef<SwiperType | null>(null);
    const { sceneInfo } = useSceneInfo();
    const speeds = useMemo(
        () => (sceneInfo?.aabb ? generateSpeeds(computeDiagonalKm(sceneInfo.aabb)) : DEFAULT_SPEEDS),
        [sceneInfo],
    );

    //--------------------------------------------------------------------------
    const handleSlideChange = (event: any) => {
        if (!cameraController) {
            return;
        }
        const speed = speeds[event.activeIndex];
        onChange?.(speed);
        cameraController.truckSpeed = speed * Math.sign(cameraController.truckSpeed);
        switch (cameraController.preset) {
            case CameraControllerPresets.fly:
                cameraController.truckSpeed /= 1e-3;
                break;
            case CameraControllerPresets.orbital:
                cameraController.dollySpeed = speed * Math.sign(cameraController.dollySpeed);
                break;
            default:
                break;
        }
    };

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (!cameraController) {
            console.error("CameraController is not provided");
            return;
        }
        const isFlyMode = cameraController.preset === CameraControllerPresets.fly;
        const initialSpeed = Math.abs(cameraController.truckSpeed) * (isFlyMode ? 1e-3 : 1);
        const index = speeds.findIndex(v => v >= initialSpeed);
        const newInitialSlide = index === -1 ? speeds.length - 1 : index;
        setInitialSlide(newInitialSlide);
    }, [cameraController, speeds]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (swiperRef.current && swiperRef.current.activeIndex !== initialSlide) {
            swiperRef.current.slideTo(initialSlide);
        }
    }, [initialSlide]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        // Swiper doesn't recompute its slide grid on its own when the number of
        // slides changes after mount (e.g. once the scene-derived speeds replace
        // the DEFAULT_SPEEDS fallback) — without this, slides overlap and the far
        // end of the range becomes unreachable.
        swiperRef.current?.update();
    }, [speeds]);

    //--------------------------------------------------------------------------
    return (
        <div
            className={`${styles.container} ${cameraController ? "" : "disabled"} ${orientation === "horizontal" ? styles.horizontal : ""} livelink-react-ui-component`}
        >
            <div className={`${styles.growContainer}`}>
                <div className={styles.headerRow}>
                    <Icon as={RiTriangleFill} className={styles.icon} />
                    <p className={styles.unit}>km/h</p>
                </div>

                <div className={styles.swiperHost}>
                    <Swiper
                        onSwiper={swiper => (swiperRef.current = swiper)}
                        onSlideChange={handleSlideChange}
                        loop={false}
                        direction={orientation === "vertical" ? "vertical" : "horizontal"}
                        initialSlide={initialSlide}
                        grabCursor
                        mousewheel
                        slidesPerView={12}
                        freeMode
                        centeredSlides
                        slideToClickedSlide
                        className={styles.swiper}
                    >
                        {speeds.map(v => (
                            <SwiperSlide className={styles.slide} key={v}>
                                <span className={styles.slideRule} />
                                {v}
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>
            </div>
            {label && <p className={styles.label}>{label}</p>}
        </div>
    );
};
