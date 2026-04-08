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
      "bg.app": { default: "neutral.canvas" },
      "bg.surface": { default: "neutral.surface" },
      "bg.rail": { default: "neutral.rail" },
      "bg.surfaceElevated": { default: "white" },
      "border.default": { default: "neutral.200" },
      "border.strong": { default: "neutral.300" },
      "text.primary": { default: "neutral.900" },
      "text.secondary": { default: "neutral.600" },
      "text.muted": { default: "neutral.500" },
      "focus.ring": { default: "brand.500" },
    },
  },
  radii: {
    md: "0.5rem",
    lg: "0.75rem",
    xl: "0.95rem",
    "2xl": "1.25rem",
  },
  styles: {
    global: {
      "html, body": {
        bg: "bg.app",
        color: "text.primary",
        fontFamily: "body",
      },
      h1: { fontFamily: "heading", lineHeight: "heading" },
      h2: { fontFamily: "heading", lineHeight: "heading" },
      h3: { fontFamily: "heading", lineHeight: "heading" },
      "*, *::before, *::after": {
        borderColor: "border.default",
      },
      "*:focus-visible": {
        outline: "none",
        boxShadow: "focus",
      },
      "::selection": {
        bg: "brand.100",
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*": {
          animationDuration: "0.001ms !important",
          animationIterationCount: "1 !important",
          transitionDuration: "0.001ms !important",
          scrollBehavior: "auto !important",
        },
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "xl",
        fontWeight: "semibold",
        minH: 10,
        h: "auto",
        px: 4,
        py: 2.5,
        maxW: "100%",
        whiteSpace: "normal",
        textAlign: "center",
        lineHeight: "1.25",
        transitionProperty: "common",
        transitionDuration: "180ms",
      },
      defaultProps: {
        colorScheme: "brand",
      },
      variants: {
        solid: {
          bg: "brand.500",
          color: "white",
          boxShadow: "xs",
          _hover: { bg: "brand.600", transform: "translateY(-1px)", boxShadow: "sm" },
          _active: { bg: "brand.700", transform: "translateY(0)" },
        },
        outline: {
          borderColor: "border.default",
          color: "text.primary",
          bg: "rgba(255,255,255,0.75)",
          _hover: { bg: "neutral.100" },
        },
        ghost: {
          _hover: { bg: "neutral.100" },
        },
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: "sm",
        color: "text.secondary",
        fontWeight: "semibold",
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: "brand.500",
        size: "md",
      },
      variants: {
        outline: {
          field: {
            borderRadius: "lg",
            bg: "rgba(255,255,255,0.86)",
            borderColor: "border.default",
            _hover: { borderColor: "border.strong" },
          },
        },
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: "brand.500",
        size: "md",
      },
      variants: {
        outline: {
          field: {
            borderRadius: "lg",
            bg: "rgba(255,255,255,0.86)",
            borderColor: "border.default",
            _hover: { borderColor: "border.strong" },
          },
        },
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: "brand.500",
      },
      variants: {
        outline: {
          borderRadius: "lg",
          bg: "rgba(255,255,255,0.86)",
          borderColor: "border.default",
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: "full",
        px: 2.5,
        py: 1,
        fontWeight: "semibold",
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: "rgba(255,255,255,0.88)",
          borderColor: "border.default",
          borderWidth: "1px",
          shadow: "sm",
          borderRadius: "2xl",
          backdropFilter: "blur(12px)",
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
            position: "sticky",
            top: 0,
            zIndex: 1,
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
    Menu: {
      baseStyle: {
        list: {
          borderRadius: "xl",
          borderColor: "border.default",
          shadow: "md",
        },
        item: {
          borderRadius: "md",
        },
      },
    },
  },
});
