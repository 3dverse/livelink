//------------------------------------------------------------------------------
import React from "react";
import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { RiTriangleFill } from "react-icons/ri";
import { CameraController, CameraControllerPresets } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { Icon } from "../../components-common/Icon";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const SPEEDS = [...Array(12).keys()].map(i => (i > 4 ? (i - 3) * 5 : i + 1));

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

    //--------------------------------------------------------------------------
    const handleSlideChange = (event: any) => {
        if (!cameraController) {
            return;
        }
        const speed = SPEEDS[event.activeIndex];
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
        const index = SPEEDS.findIndex(v => v >= initialSpeed);
        const newInitialSlide = index === -1 ? SPEEDS.length - 1 : index;
        setInitialSlide(newInitialSlide);
    }, [cameraController]);

    //--------------------------------------------------------------------------
    useEffect(() => {
        if (swiperRef.current && swiperRef.current.activeIndex !== initialSlide) {
            swiperRef.current.slideTo(initialSlide);
        }
    }, [initialSlide]);

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
                        slidesPerView={11}
                        freeMode
                        centeredSlides
                        slideToClickedSlide
                        className={styles.swiper}
                    >
                        {SPEEDS.map(v => (
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
