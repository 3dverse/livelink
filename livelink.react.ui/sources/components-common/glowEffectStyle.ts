//------------------------------------------------------------------------------
export const glowEffectStyle = {
    _before: {
        content: `""`,
        position: "absolute",
        top: "50%",
        left: "50%",
        translate: "-50% -50%",
        width: "150%",
        maxWidth: { base: 48, xl: 72 },
        aspectRatio: "1 / 1 ",

        mixBlendMode: "screen",
        background: "radial-gradient(var(--color-bg-overground), transparent)",
        borderRadius: "100%",
        filter: { base: "blur(50px)", xl: "blur(70px)" },

        pointerEvents: "none",
        zIndex: 0,
    },
};
