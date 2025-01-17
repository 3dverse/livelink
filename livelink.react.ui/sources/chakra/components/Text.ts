//--------------------------------------------------------------------------
import { defineStyleConfig } from "@chakra-ui/react";

//--------------------------------------------------------------------------
export default defineStyleConfig({
    baseStyle: {
        mt: 0,
        fontWeight: 400,
    },
    sizes: {
        xs: {
            fontSize: "xs",
        },
        sm: {
            fontSize: "sm",
            lineHeight: "5",
        },
        md: {
            fontSize: "md",
        },
        lg: {
            fontSize: "lg",
        },
        xl: {
            fontSize: "xl",
        },
    },
    variants: {
        secondary: {
            color: "content.secondary",
        },
        tertiary: {
            color: "content.tertiary",
        },
        caption: {
            color: "content.tertiary",
            fontSize: "xs",
        },
    },
});
