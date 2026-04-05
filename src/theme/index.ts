import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

import { colors } from "./colors";
import { typography } from "./typography";
import { spacing } from "./spacing";
import { shadows } from "./shadows";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

export const appTheme = extendTheme({
  config,
  colors,
  fonts: typography.fonts,
  fontSizes: typography.fontSizes,
  fontWeights: typography.fontWeights,
  lineHeights: typography.lineHeights,
  space: spacing,
  shadows,
  semanticTokens: {
    colors: {
      "bg.app": { default: "neutral.50" },
      "bg.surface": { default: "neutral.surface" },
      "border.default": { default: "neutral.200" },
      "text.primary": { default: "neutral.900" },
      "text.secondary": { default: "neutral.500" },
      "text.muted": { default: "neutral.400" },
    },
  },
  styles: {
    global: {
      "html, body": {
        bg: "bg.app",
        color: "text.primary",
        fontFamily: "body",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "lg",
        fontWeight: "semibold",
      },
      defaultProps: {
        colorScheme: "brand",
      },
      variants: {
        solid: {
          bg: "brand.500",
          color: "white",
          _hover: { bg: "brand.600" },
        },
        outline: {
          borderColor: "border.default",
          color: "text.primary",
          _hover: { bg: "neutral.100" },
        },
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: "brand.500",
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: "brand.500",
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: "bg.surface",
          borderColor: "border.default",
          borderWidth: "1px",
          shadow: "sm",
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            color: "text.secondary",
            borderColor: "border.default",
            fontWeight: "semibold",
            bg: "neutral.50",
          },
          td: {
            borderColor: "border.default",
          },
          tr: {
            _hover: {
              bg: "neutral.50",
            },
          },
        },
      },
    },
  },
});
