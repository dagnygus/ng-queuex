import { getActiveConsumer } from "@angular/core/primitives/signals";
import { CleanupScope } from "./cleanup_scope/cleanup_scope";
import { DestroyRef, isSignal } from "@angular/core";

declare const ngDevMode: boolean | undefined;

export const NG_DEV_MODE = typeof ngDevMode === 'undefined' || !!ngDevMode

export function assertInReactiveContextOrInCleanupScope(message: string): void {
  if (!(getActiveConsumer() || CleanupScope.current())) {
    throw new Error(message);
  }
}

export function isDestroyRef(obj: any): boolean {
  return obj != null && !isSignal(obj) && typeof obj === 'object' && typeof obj.onDestroy === 'function';
}

export class ReusableDestroyRef implements DestroyRef {
  private _callbacks: VoidFunction[] = [];

  destroyed = false

  destroy(): void {
    this.destroyed = true;
    try {
      while(this._callbacks.length) {
        this._callbacks.shift()!();
      }
    } finally {
      if (this._callbacks.length) {
        this.destroy();
      } else {
        this.destroyed = false;
      }
    }
  }

  onDestroy(callback: () => void): () => void {
    this._callbacks.push(callback);
    return () => {
      const index = this._callbacks.indexOf(callback);
      if (index > -1) {
        this._callbacks.splice(index, 1);
      }
    }
  }

  private _flushCallbacks(): void {
    try {
      while(this._callbacks.length) {
        this._callbacks.shift()!();
      }
    } finally {
      if (this._callbacks.length) {
        this._flushCallbacks();
      }
    }
  }


}

/**
 * Options passed to group of signal creation functions.
 */
export interface JoinSignalCreationOptions {

  /**
   * A debug name for the signal. Used in Angular DevTools to identify the signal.
   */
  debugName?: string;

  /**
   * Defines how the signal handles initialization and cleanup.
   *
   * - `'reactive'` — the signal manages its lifecycle based on reactive consumers (e.g. `effect()` or Angular's component templates).
   *   It initializes when the first consumer subscribes and deinitializes when the last consumer is removed. However, if the consumer
   *   reappears, the signal will be reinitialized.
   *   **Restriction:** the signal can only be read inside a reactive context like `effect()` or component template.
   *
   * - `'injection'` — A signal is tied to the Angular DI lifecycle. Cleanup is managed via the provided `DestroyRef` or the current injection context.
   *   A signal can be created anywhere (as long as it has a provided `DestroyRef`) and read without reactive-context restriction.
   *
   * @default 'reactive'
   */
  cleanupStrategy?: 'reactive' | 'injection';

  /**
   * object of type `DestroyRef` for injection context cleanup strategy.
   */
  destroyRef?: DestroyRef;

}
