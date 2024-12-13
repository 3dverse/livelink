//------------------------------------------------------------------------------
export const hexToVec3 = (hex: string) => {
    hex = hex.replace(/^#/, "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return [r / 255, g / 255, b / 255];
};

//------------------------------------------------------------------------------
export const vec3ToHex = (vec3: [number, number, number]) => {
    if (!vec3?.[0]) return "#000000";
    const r = Math.round(vec3[0] * 255)
        .toString(16)
        .padStart(2, "0");
    const g = Math.round(vec3[1] * 255)
        .toString(16)
        .padStart(2, "0");
    const b = Math.round(vec3[2] * 255)
        .toString(16)
        .padStart(2, "0");

    return `#${r}${g}${b}`;
};
