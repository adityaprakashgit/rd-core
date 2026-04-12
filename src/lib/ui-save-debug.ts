type SaveUxEvent = "save_started" | "save_success" | "save_failed" | "route_changed" | "scroll_y_before_after";

function isEnabled() {
  if (typeof window === "undefined") return false;
  const envEnabled = process.env.NEXT_PUBLIC_UI_SAVE_DEBUG === "1";
  const localEnabled = window.localStorage.getItem("recycos:save-debug") === "1";
  return envEnabled || localEnabled;
}

export function logSaveUxEvent(event: SaveUxEvent, data: Record<string, unknown> = {}) {
  if (!isEnabled() || typeof window === "undefined") return;
  console.info("[save-ux]", {
    event,
    at: new Date().toISOString(),
    scrollY: window.scrollY,
    path: window.location.pathname,
    ...data,
  });
}

export function captureScrollY() {
  if (typeof window === "undefined") return null;
  return window.scrollY;
}

export function restoreScrollY(targetY: number | null) {
  if (typeof window === "undefined" || targetY === null) return;
  requestAnimationFrame(() => {
    window.scrollTo({ top: targetY, behavior: "auto" });
    logSaveUxEvent("scroll_y_before_after", { restoredTo: targetY, after: window.scrollY });
  });
}
