//------------------------------------------------------------------------------
export const connectButtonContainerClassName = (hasInstance: boolean) => {
    return `absolute ${hasInstance ? "top-6 left-6" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"}`;
};
