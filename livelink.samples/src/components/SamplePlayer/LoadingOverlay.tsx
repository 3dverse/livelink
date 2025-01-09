//------------------------------------------------------------------------------
export const LoadingOverlay = ({ stage = "Connecting to 3dverse..." }: { stage?: string }) => {
    return (
        <div
            className={`
                absolute
                glow-effect
                h-full
                w-full
                z-30
                bg-ground
                flex flex-col grow justify-center items-center gap-2
                before:bg-[color-mix(in_srgb,var(--color-bg-foreground)_90%,var(--color-content-secondary))]
            `}
        >
            <svg
                viewBox="0 0 40 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 lg:h-10 mb-3 text-accent"
                style={{
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
                        <stop offset=".34" stop-color="currentColor" stop-opacity=".7" />
                        <stop offset=".96" stop-color="currentColor" stop-opacity=".1" />
                    </linearGradient>
                    <linearGradient
                        id="3dverse-logo-rocket-dark_gradient2"
                        x1="34.233"
                        y1="22.311"
                        x2="8.55"
                        y2="47.994"
                        gradientUnits="userSpaceOnUse"
                    >
                        <stop offset=".34" stop-color="currentColor" stop-opacity=".7" />
                        <stop offset=".96" stop-color="currentColor" stop-opacity=".1" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="loader-progress-bar-indeterminate" role="progressbar">
                <div className="loader-progress-bar-indeterminate__track" />
            </div>
            <p className="font-primary font-[500] text-tertiary text-2xs tracking-wide">{stage}</p>
        </div>
    );
};
