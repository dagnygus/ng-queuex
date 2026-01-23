import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";
import { Schedulers } from "../../schedulers/schedulers";

/**
 * Delays the emission of each value from the source `Signal<T>` by the
 * specified duration in milliseconds.
 *
 * When the source signal emits a value, that value is held for the given
 * `due` time before being forwarded to the output signal. Each emission
 * is delayed independently.
 *
 * @param due
 * The delay duration in milliseconds.
 *
 * @returns
 * A signal operator function that emits each source value after the specified delay.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const delayed = signalPipe(
 *   source,
 *   [ delay(300) ]
 * );
 * ```
 *
 * @remarks
 * - Each source value is delayed independently.
 * - Values are forwarded in the order they were emitted.
 * - The output signal will reflect the delayed values after the specified time.
 */
export function delay<T>(due: number): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(delay);
    const scope = CleanupScope.assertCurrent(delay);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);
    const timeoutCleanups: (() => void)[] = [];

    scope.add(() => {
      while(timeoutCleanups.length) {
        timeoutCleanups.shift()!();
      }
    });

    subscribe(prevSource, (value) => {
      const timeoutCleanup = schedulers.setTimeout(() => {
        const index = timeoutCleanups.indexOf(timeoutCleanup);
        if (index > -1) {
          timeoutCleanups.splice(index, 1);
        }
        nextSource.set(value);
      }, due);

      timeoutCleanups.push(timeoutCleanup);
    });

    return nextSource.asReadonly();
  }
}
