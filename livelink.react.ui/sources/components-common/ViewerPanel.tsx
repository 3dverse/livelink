//------------------------------------------------------------------------------
import React from "react";
import { ReactNode } from "react";
import { Flex, FlexProps } from "@chakra-ui/react";

//------------------------------------------------------------------------------
export const ViewerPanel = ({ children, ...flexProps }: { children: ReactNode } & FlexProps) => {
    //--------------------------------------------------------------------------
    // UI
    return (
        <Flex
            bgColor="color-mix(in srgb, var(--color-bg-foreground) 85%, transparent)"
            backdropFilter="auto"
            backdropBlur="34px"
            rounded="md"
            shadow="3xl"
            {...flexProps}
        >
            {children}
        </Flex>
    );
};
