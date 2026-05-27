import backendRoutesMarkdown from "../../../docs/backend-routes.md?raw";
import type { HttpShortcutMethod } from "../app/shared";

export interface BackendRouteCatalogEntry {
  id: string;
  method: HttpShortcutMethod;
  path: string;
  description: string;
}

const routeLinePattern = /^-\s+`(GET|POST|PATCH|DELETE|HEAD)\s+([^`]+)`\s+(.+)$/gm;

export function backendRouteCatalogEntryId(method: HttpShortcutMethod, path: string): string {
  return `${method} ${path}`;
}

export const backendRouteCatalog: BackendRouteCatalogEntry[] = Array.from(
  backendRoutesMarkdown.matchAll(routeLinePattern),
  (match) => {
    const method = match[1] as HttpShortcutMethod;
    const path = match[2].trim();
    return {
      id: backendRouteCatalogEntryId(method, path),
      method,
      path,
      description: match[3].trim(),
    };
  },
);

export function findBackendRouteCatalogEntry(
  method: HttpShortcutMethod,
  path: string,
): BackendRouteCatalogEntry | undefined {
  return backendRouteCatalog.find((entry) => entry.method === method && entry.path === path);
}
