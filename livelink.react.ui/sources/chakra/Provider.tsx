//------------------------------------------------------------------------------
import React from "react";
import { ChakraProvider } from "@chakra-ui/react";

//------------------------------------------------------------------------------
import { theme } from "./theme";

//------------------------------------------------------------------------------
type ProvidersProps = Readonly<{
    children: React.ReactNode;
}>;
//------------------------------------------------------------------------------
export function Provider({ children }: ProvidersProps) {
    return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
