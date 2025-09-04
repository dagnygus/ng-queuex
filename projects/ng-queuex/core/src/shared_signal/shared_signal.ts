import { computed, isSignal, signal, Signal, WritableSignal } from "@angular/core";

declare const ngDevMode: boolean | undefined;

/**
 * Represents a reference to a shared signal.
 *
 * Provides access to the underlying signal (`ref`)
 * and a method (`set`) to update its value directly or
 * by linking it to another signal.
 *
 */
export interface SharedSignalRef<T> {

   /**
   * The underlying signal reference.
   */
  ref: Signal<T>

   /**
   * Updates the signal value.
   *
   * If a plain value is provided, the signal is set directly.
   * If another signal is provided, the reference will follow that signal.
   *
   * @param value A new value or another signal to bind.
   */
  set<T>(value: T | Signal<T>): void
}

interface InternalSharedSignalRef<T> extends SharedSignalRef<T> {
  __internalSource__: WritableSignal<any>;
  __externalSource__: Signal<T> | null
}

/**
 * Creates a shared signal reference.
 *
 * A shared signal allows you to either wrap a plain value into a signal
 * or forward another signal reference. The returned object provides
 * access to the underlying signal (`ref`) and a `set` method for updating
 * its value or re-linking it to a different signal.
 *
 *
 * @param initialValue The initial value of the signal, or another signal to bind.
 * @param debugName Optional developer-friendly label for debugging purposes.
 *
 * @returns A {@link SharedSignalRef} object containing the signal reference and mutation API.
 *
 * @example
 * ```ts
 * const count = sharedSignal(0, 'counter');
 * count.set(1);
 * console.log(count.ref()); // 1
 *
 * const source = signal(42);
 * count.set(source);
 * console.log(count.ref()); // 42
 * ```
 */
export function sharedSignal<T>(initialValue: T | Signal<T>, debugName?: string): SharedSignalRef<T> {
  const internalSource = signal<any>(initialValue)
  const externalSource = isSignal(initialValue) ? initialValue : null;
  const signalRef: InternalSharedSignalRef<T> = {
    __internalSource__: internalSource,
    __externalSource__: externalSource,
    set(value) {
      if (isSignal(value)) {
        this.__externalSource__ = value as any
      } else {
        this.__externalSource__ = null;
      }
      this.__internalSource__.set(value);
    },
    ref: null!
  }

  const compotation: () => T = (function (this: InternalSharedSignalRef<T>) {
    const result = this.__internalSource__();
    if (this.__externalSource__) {
      return this.__externalSource__();
    }
    return result;
  }).bind(signalRef);

  signalRef.ref = computed(compotation);

  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    (signalRef as any).toString = () => `[SharedSignalRef.ref: ${signalRef.ref}]`;
    if (typeof debugName === 'string') {
      (signalRef as any).debugName = debugName;
    } else {
      (signalRef as any).debugName = 'SharedSignalRef';
    }
  }

  return signalRef;
}
