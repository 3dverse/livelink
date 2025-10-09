//------------------------------------------------------------------------------
import React from "react";
import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { RiTriangleFill } from "react-icons/ri";
import { CameraController, CameraControllerPresets } from "@3dverse/livelink";

//------------------------------------------------------------------------------
import { Icon } from "../../components-common/Icon";
import styles from "./style.module.css";

//------------------------------------------------------------------------------
const SPEEDS = [...Array(12).keys()].map(i => (i > 4 ? (i - 3) * 5 : i + 1));

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------
export const CameraSpeedSlider = ({ cameraController }: { cameraController?: CameraController }) => {
    //--------------------------------------------------------------------------
    const [initialSlide, setInitialSlide] = useState(0);

    //--------------------------------------------------------------------------
    const handleSlideChange = (event: any) => {
        if (!cameraController) {
            return;
        }
        const speed = SPEEDS[event.activeIndex];
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
        const index = SPEEDS.findIndex(v => v >= cameraController.truckSpeed);
        setInitialSlide(index === -1 ? SPEEDS.length - 1 : index);
    }, [cameraController]);

    //--------------------------------------------------------------------------
    return (
        <div className={`${styles.container} ${cameraController ? "" : "disabled"} livelink-react-ui-component`}>
            <div className={styles.growContainer}>
                <div className={styles.headerRow}>
                    <Icon as={RiTriangleFill} className={styles.icon} />
                    <p className={styles.unit}>km/h</p>
                </div>

                <div className={styles.swiperHost}>
                    <Swiper
                        onSlideChange={handleSlideChange}
                        loop={false}
                        direction="vertical"
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

            <p className={styles.label}>Move speed</p>
        </div>
    );
};
