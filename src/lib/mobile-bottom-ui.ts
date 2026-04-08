const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";
const MOBILE_NAV_EDGE_GAP = "8px";
const MOBILE_NAV_DOCK_HEIGHT = "72px";
const MOBILE_ACTION_RAIL_GAP = "12px";

export const MOBILE_NAV_BOTTOM_OFFSET = `calc(${SAFE_AREA_BOTTOM} + ${MOBILE_NAV_EDGE_GAP})`;
export const MOBILE_ACTION_RAIL_BOTTOM_OFFSET = `calc(${SAFE_AREA_BOTTOM} + ${MOBILE_NAV_DOCK_HEIGHT} + ${MOBILE_ACTION_RAIL_GAP})`;
export const MOBILE_CONTENT_BOTTOM_PADDING = `calc(${SAFE_AREA_BOTTOM} + ${MOBILE_NAV_DOCK_HEIGHT} + 56px)`;

export const mobileBottomSurfaceStyle = {
  borderWidth: "1px",
  borderColor: "border.default",
  bg: "rgba(255,255,255,0.96)",
  backdropFilter: "blur(16px)",
  borderRadius: "2xl",
  boxShadow: "lg",
  color: "text.primary",
} as const;

export const mobileBottomInteractiveSx = {
  "& .chakra-button, & .chakra-icon-button": {
    color: "text.primary",
  },
  "& .chakra-button[disabled], & .chakra-icon-button[disabled]": {
    opacity: 0.56,
  },
  "& svg": {
    color: "currentColor",
    stroke: "currentColor",
    opacity: 1,
  },
} as const;
