import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Emits a new inner `Signal<T | undefined>` (a "window") each time the
 * `windowBoundaries` signal emits. Each emitted inner signal reflects values
 * from the source signal that arrive while that window is active.
 *
 * The inner signal starts with `undefined` and updates as the source emits;
 * when the boundary signal emits the active window is closed (disposed) and
 * a new inner signal is created on the next boundary emission.
 *
 * @param windowBoundaries
 * A signal whose emissions mark window boundaries. Each time it emits a value
 * the current window is closed and the operator emits a new inner window signal.
 *
 * @returns
 * A signal operator function that emits inner signals (windows). Each inner
 * signal yields the source values produced while that window was active,
 * or `undefined` until the first value arrives.
 *
 * @example
 * ```ts
 * const src = signal<number | undefined>(undefined);
 * const boundary = signal(false);
 *
 * const windows = signalPipe(
 *   src,
 *   [ window(boundary) ]
 * );
 *
 * const firstWindow = windows(); // Signal<T|undefined> for the first window
 *
 * // When `boundary` emits, the current window closes and a new window is emitted.
 * ```
 *
 * @remarks
 * - Inner signals initially contain `undefined` until the source emits a defined value.
 * - Useful when you need to segment a stream of signal updates into time- or event-based windows.
 */
export function window<T>(windowBoundaries: Signal<any>): SignalOperatorFunction<T, Signal<T | undefined>> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(window) && assertNotInReactiveContext(window);
    let intermediateSource = signal<any>(undefined);
    const nextSource = signal<Signal<T>>(intermediateSource);

    subscribe(prevSource, (value) => { intermediateSource.set(value); });

    let sync = true;
    subscribe(windowBoundaries, () => {
      if (sync) { return; }
      intermediateSource = signal(undefined);
      nextSource.set(intermediateSource.asReadonly());
    });
    sync = false;

    return nextSource.asReadonly();
  }
}
