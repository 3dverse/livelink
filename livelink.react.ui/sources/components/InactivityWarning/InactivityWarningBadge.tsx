//------------------------------------------------------------------------------
import React, { RefObject, useEffect } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

//------------------------------------------------------------------------------
import { ViewerPanel } from "../../components-common/ViewerPanel";

//------------------------------------------------------------------------------
export const InactivityWarningBadge = ({
    timeLeft,
    onActivityReset,
    animatedPathRef,
    animatedOverlayRef,
}: {
    timeLeft: number;
    onActivityReset: () => void;
    animatedPathRef: RefObject<SVGPathElement>;
    animatedOverlayRef: RefObject<HTMLDivElement>;
}) => {
    //------------------------------------------------------------------------------
    useEffect(() => {
        window.addEventListener("click", onActivityReset);
        window.addEventListener("mousemove", onActivityReset);
        window.addEventListener("scroll", onActivityReset);
        window.addEventListener("touchstart", onActivityReset);
        return () => {
            window.removeEventListener("click", onActivityReset);
            window.removeEventListener("mousemove", onActivityReset);
            window.removeEventListener("scroll", onActivityReset);
            window.removeEventListener("touchstart", onActivityReset);
        };
    }, [onActivityReset]);

    //------------------------------------------------------------------------------
    return (
        <>
            <Box
                ref={animatedOverlayRef}
                pos="fixed"
                top={0}
                left={0}
                bottom={0}
                right={0}
                width="100%"
                height="100%"
                bgColor="bg.underground"
                zIndex={1}
            />
            <Flex as="aside" pos="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" zIndex={2}>
                <ViewerPanel
                    display="flex"
                    flexDir="column"
                    w="18rem"
                    p="6px"
                    bgColor="color-mix(in srgb, var(--color-bg-ground) 20%, transparent)"
                    rounded="full"
                    shadow="none"
                    className="animate-appear-top"
                >
                    <Box pos="relative" textAlign="center" px={5} py={3}>
                        <Box
                            pos="absolute"
                            top="-1px"
                            left="50%"
                            transform="translate(-50%, -50%)"
                            w="2px"
                            h={2}
                            bgColor="accent.500"
                            rounded="full"
                            filter="blur(1px)"
                        />
                        <Box
                            as="svg"
                            pos="absolute"
                            top="-2px"
                            left="-1px"
                            width="277px"
                            height="67px"
                            viewBox="0 0 277 67"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            overflow="visible"
                        >
                            <Box
                                as="path"
                                d="M138.5 1H33.5C15.5507 1 1 15.5507 1 33.5V33.5C1 51.4493 15.5507 66 33.5 66H243.5C261.449 66 276 51.4493 276 33.5V33.5C276 15.5507 261.449 1 243.5 1H139"
                                strokeWidth={1}
                                stroke="border.primaryAlpha"
                            />
                            <Box
                                ref={animatedPathRef}
                                as="path"
                                d="M138.5 1H33.5C15.5507 1 1 15.5507 1 33.5V33.5C1 51.4493 15.5507 66 33.5 66H243.5C261.449 66 276 51.4493 276 33.5V33.5C276 15.5507 261.449 1 243.5 1H139"
                                stroke="accent.500"
                                strokeWidth={2}
                                style={{
                                    strokeDasharray: 624,
                                    strokeDashoffset: 624,
                                }}
                                filter="blur(1px)"
                            />
                        </Box>
                        <Text size="sm" color="content.primary">
                            Move cursor to keep 3D view.
                        </Text>
                        <Text size="xs" color="content.secondary" mt="1px">
                            Closing in{" "}
                            <Box
                                as="span"
                                color="accent.500"
                                letterSpacing=".03em"
                                style={{
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {timeLeft > 9 ? (
                                    timeLeft.toString().padStart(2, "0")
                                ) : (
                                    <Box as="span" pl="8px">
                                        {timeLeft}
                                    </Box>
                                )}
                                s
                            </Box>
                        </Text>
                    </Box>
                </ViewerPanel>
            </Flex>
        </>
    );
};
