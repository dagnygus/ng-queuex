import { getActiveConsumer } from "@angular/core/primitives/signals";
import { CleanupScope } from "./cleanup_scope/cleanup_scope";
import { DestroyRef, isSignal } from "@angular/core";

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


    throw new Error("Method not implemented.");
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
