const closeFloatingMenusEvent = "flac-cafe-close-floating-menus";

export function closeFloatingMenus() {
  window.dispatchEvent(new Event(closeFloatingMenusEvent));
}

export function listenForCloseFloatingMenus(handler: () => void) {
  window.addEventListener(closeFloatingMenusEvent, handler);
  return () => window.removeEventListener(closeFloatingMenusEvent, handler);
}
