//--------------------------------------------------------------------------
import { checkboxAnatomy } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react";

//--------------------------------------------------------------------------
const { definePartsStyle, defineMultiStyleConfig } = createMultiStyleConfigHelpers(checkboxAnatomy.keys);

//--------------------------------------------------------------------------
const baseStyle = definePartsStyle({
    container: {
        fontSize: ".5rem !important",
        "--checkbox-border-color": "var(--3dverse-color-content-tertiary)",
        _hover: {
            "--checkbox-border-color": "var(--3dverse-color-content-secondary)",
        },
        _focus: {
            "--checkbox-border-color": "var(--3dverse-color-accent)",
        },
        _active: {
            "--checkbox-border-color": "var(--3dverse-color-accent)",
        },
        _indeterminate: {
            "--checkbox-border-color": "var(--3dverse-color-accent)",
        },
    },
    control: {
        borderWidth: "1px",
        borderColor: "var(--3dverse-checkbox-border-color)",
        _checked: {
            bg: "accent.500",
            borderColor: "accent.500",
            color: "content.primaryDark",

            _hover: {
                bg: "accent.500",
                borderColor: "accent.500",
            },
        },
        _focusVisible: {
            boxShadow: "none",
        },
        _indeterminate: {
            color: "content.tertiary",
            bgColor: "transparent",
            borderColor: "content.tertiary",
        },
    },
    label: {
        fontSize: ".5rem",
    },
});

//--------------------------------------------------------------------------
const sizes = {
    xs: definePartsStyle({
        control: defineStyle({
            boxSize: "10px",
        }),
        label: defineStyle({
            fontSize: "xs",
            marginLeft: "6px",
        }),
    }),
};

//--------------------------------------------------------------------------
export default defineMultiStyleConfig({ baseStyle, sizes });
