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
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.625rem",
    "2xl": "0.75rem",
  },
  styles: {
    global: {
      html: {
        fontSize: { base: "15px", md: "15px", xl: "15px" },
      },
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
        borderRadius: "lg",
        fontWeight: "semibold",
        minH: 9,
        h: "auto",
        px: 3.5,
        py: 2,
        fontSize: { base: "sm", md: "md" },
        maxW: "100%",
        whiteSpace: "normal",
        textAlign: "center",
        lineHeight: "1.2",
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
          boxShadow: "none",
          _hover: { bg: "brand.600" },
          _active: { bg: "brand.700", transform: "translateY(0)" },
        },
        outline: {
          borderColor: "border.default",
          color: "text.primary",
          bg: "bg.surface",
          _hover: { bg: "neutral.50", borderColor: "border.strong" },
        },
        ghost: {
          _hover: { bg: "neutral.100" },
        },
      },
      sizes: {
        sm: { minH: 8, px: 3, fontSize: { base: "sm", md: "md" } },
        md: { minH: 9, px: 3.5, fontSize: { base: "sm", md: "md" } },
        lg: { minH: 10, px: 4, fontSize: { base: "md", md: "lg" } },
      },
    },
    FormLabel: {
      baseStyle: {
        fontSize: { base: "xs", md: "sm" },
        color: "text.secondary",
        fontWeight: "semibold",
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: "brand.500",
        size: "sm",
      },
      variants: {
        outline: {
          field: {
            borderRadius: "lg",
            bg: "bg.surface",
            borderColor: "border.default",
            _hover: { borderColor: "border.strong" },
            _focusVisible: { borderColor: "brand.500", boxShadow: "focus" },
          },
        },
      },
      sizes: {
        sm: { field: { h: 9, px: 3, fontSize: { base: "sm", md: "md" } } },
        md: { field: { h: 10, px: 3.5, fontSize: { base: "sm", md: "md" } } },
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: "brand.500",
        size: "sm",
      },
      variants: {
        outline: {
          field: {
            borderRadius: "lg",
            bg: "bg.surface",
            borderColor: "border.default",
            _hover: { borderColor: "border.strong" },
            _focusVisible: { borderColor: "brand.500", boxShadow: "focus" },
          },
        },
      },
      sizes: {
        sm: { field: { h: 9, px: 3, fontSize: { base: "sm", md: "md" } } },
        md: { field: { h: 10, px: 3.5, fontSize: { base: "sm", md: "md" } } },
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: "brand.500",
        size: "sm",
      },
      variants: {
        outline: {
          borderRadius: "lg",
          bg: "bg.surface",
          borderColor: "border.default",
          _hover: { borderColor: "border.strong" },
          _focusVisible: { borderColor: "brand.500", boxShadow: "focus" },
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: "md",
        px: 2,
        py: 0.5,
        fontWeight: "semibold",
        fontSize: { base: "2xs", md: "xs" },
        letterSpacing: "0.02em",
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: "bg.surface",
          borderColor: "border.default",
          borderWidth: "1px",
          shadow: "none",
          borderRadius: "xl",
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
            bg: "neutral.100",
            position: "sticky",
            top: 0,
            zIndex: 1,
            textTransform: "none",
            fontSize: { base: "2xs", md: "xs" },
            px: 3,
            py: 2.5,
          },
          td: {
            borderColor: "border.default",
            px: 3,
            py: 2.5,
            fontSize: { base: "sm", md: "md" },
          },
          tr: {
            _hover: {
              bg: "neutral.50",
            },
          },
        },
      },
    },
    Tabs: {
      variants: {
        "line-enterprise": {
          tablist: {
            borderBottomWidth: "1px",
            borderColor: "border.default",
            gap: 1,
          },
          tab: {
            borderBottomWidth: "2px",
            borderColor: "transparent",
            color: "text.secondary",
            fontWeight: "medium",
            px: 3,
            py: 2.5,
            fontSize: { base: "xs", md: "sm" },
            borderRadius: "0",
            _selected: {
              color: "text.primary",
              borderColor: "brand.500",
              fontWeight: "semibold",
            },
            _hover: {
              color: "text.primary",
              bg: "neutral.50",
            },
          },
        },
      },
    },
    Menu: {
      baseStyle: {
        list: {
          borderRadius: "lg",
          borderColor: "border.default",
          shadow: "sm",
        },
        item: {
          borderRadius: "md",
        },
      },
    },
  },
});
