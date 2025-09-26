import { getActiveConsumer } from "@angular/core/primitives/signals";
import { CleanupScope } from "./cleanup_scope/cleanup_scope";

declare const ngDevMode: boolean | undefined;

export const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode

export function assertInReactiveContextXorInCleanupScope(message: string): void {
  if (getActiveConsumer() && CleanupScope.current()) {
    throw new Error(message);
  }

  if (!(getActiveConsumer() || CleanupScope.current())) {
    throw new Error(message);
  }
}
