//------------------------------------------------------------------------------
import React from "react";
import { Box, Flex } from "@chakra-ui/react";

//------------------------------------------------------------------------------
export const LoadingOverlay = ({ stage = "Connecting to 3dverse..." }: { stage?: string }) => {
    return (
        <>
            <style>
                {`
                    .glow-effect {
                        @apply relative;

                        &:before {
                            content: "";
                            background-color: color-mix(in srgb, var(--color-bg-ground) 94%, var(--color-content-secondary));
                            mix-blend-mode: screen;
                            @apply absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] max-w-48 xl:max-w-72 aspect-square rounded-full blur-[50px] xl:blur-[70px] pointer-events-none;
                        }

                        &--lg:before {
                            @apply max-w-[24rem] blur-[80px];
                        }
                    }

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
                // does not work
                bgColor="bg.ground"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                gap={"1rem"}
            >
                {/* Tried to emulate the before, does not work either */}
                <Box
                    position="absolute"
                    className="glow-effect"
                    height="100%"
                    width="100%"
                    bg="color-mix(in_srgb,var(--color-bg-foreground)_90%,var(--color-content-secondary))"
                />

                <Box width="40px" height="56px">
                    <svg
                        viewBox="0 0 40 56"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                            color: "var(--color-accent)",
                            filter: "drop-shadow(0 18px 2px color-mix(in srgb, var(--color-bg-ground) 50%, transparent))",
                        }}
                    >
                        <path
                            d="m.007 27.319 12.303 12.03V55.32L0 43.28l.007-15.962Z"
                            fill="url(#3dverse-logo-rocket-dark_gradient1)"
                        />
                        <path
                            d="M39.993 27.319 27.69 39.349V55.32L40 43.28l-.007-15.962Z"
                            fill="url(#3dverse-logo-rocket-dark_gradient2)"
                        />
                        <path
                            d="M33.257 18.356v-5.668c0-16.917-26.514-16.917-26.514 0v5.679L0 27.319V43.28l12.743-15.97v7.055l7.256 7.096 7.258-7.096V27.31L40 43.28V27.31l-6.743-8.955Zm-9.081.01h-8.352V12.44c0-5.973 8.352-5.973 8.352 0v5.927Z"
                            fill="currentColor"
                        />
                        <defs>
                            <linearGradient
                                id="3dverse-logo-rocket-dark_gradient1"
                                x1="-.64"
                                y1="29.494"
                                x2="17.183"
                                y2="60.499"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop offset=".34" stopColor="currentColor" stopOpacity=".7" />
                                <stop offset=".96" stopColor="currentColor" stopOpacity=".1" />
                            </linearGradient>
                            <linearGradient
                                id="3dverse-logo-rocket-dark_gradient2"
                                x1="34.233"
                                y1="22.311"
                                x2="8.55"
                                y2="47.994"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop offset=".34" stopColor="currentColor" stopOpacity=".7" />
                                <stop offset=".96" stopColor="currentColor" stopOpacity=".1" />
                            </linearGradient>
                        </defs>
                    </svg>
                </Box>
                <div className="loader-progress-bar-indeterminate" role="progressbar">
                    <div className="loader-progress-bar-indeterminate__track" />
                </div>
                <p className="font-primary font-[500] text-tertiary text-2xs tracking-wide">{stage}</p>
            </Flex>
        </>
    );
};
