import { keyframes } from "@emotion/react";

const pulseKeyframes = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

export const pulseAnimation = `${pulseKeyframes} 1.5s infinite`;
