//------------------------------------------------------------------------------
import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Provider } from "../../chakra/Provider";
import { glowEffectStyle } from "../../components-common/glowEffectStyle";
import { Rocket3dverse } from "../../components-common/Rocket3dverse";

//------------------------------------------------------------------------------
export const LoadingOverlay = ({ stage = "Connecting to 3dverse..." }: { stage?: string }) => {
    return (
        <Provider>
            <style>
                {`
                    .loader-progress-bar-indeterminate {
                        width: 3.5rem;
                        padding: 7px 8px;
                        background-color: var(--color-bg-foreground);
                        border-radius: 2rem;
                    }

                    .loader-progress-bar-indeterminate__track {
                        position: relative;
                        height: 1px;
                        width: 100%;
                        border-radius: 1rem;
                        overflow: hidden;
                        background-color: var(--color-bg-underground);

                        &:before {
                            content: "''";
                            position: absolute;
                            height: 100%;
                            min-width: 50%;
                            will-change: left;
                            border-radius: 1px;
                            background-color: var(--color-accent);
                            animation: 1s ease 0s infinite loader-progress-bar-indeterminate;
                        }
                        &:after {
                            content: "";
                            position: absolute;
                            height: 100%;
                            min-width: 75%;
                            will-change: left;
                            border-radius: 1px;
                            background-color: var(--color-accent);
                            opacity: 0.4;
                            animation: 1.5s ease 0s infinite loader-progress-bar-indeterminate;
                            animation-delay: 0.25s;
                        }
                    }

                    @keyframes loader-progress-bar-indeterminate {
                        0% {
                            left: -40%;
                        }
                        100% {
                            left: 100%;
                        }
                    }
                `}
            </style>

            <Flex
                position="absolute"
                height="100%"
                width="100%"
                bgColor="bg.ground"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                gap={3}
                sx={glowEffectStyle}
            >
                <Box
                    boxSize={{ base: 7, lg: 8 }}
                    mb={4}
                    color="accent.500"
                    filter="drop-shadow(0 18px 2px color-mix(in srgb, var(--color-bg-ground) 50%, transparent))"
                >
                    <Rocket3dverse />
                </Box>
                <div className="loader-progress-bar-indeterminate" role="progressbar">
                    <div className="loader-progress-bar-indeterminate__track" />
                </div>
                {stage && (
                    <Text
                        color="content.tertiary"
                        fontSize="xs"
                        fontWeight={500}
                        letterSpacing="0.02em"
                        userSelect="none"
                    >
                        {stage}
                    </Text>
                )}
            </Flex>
        </Provider>
    );
};
