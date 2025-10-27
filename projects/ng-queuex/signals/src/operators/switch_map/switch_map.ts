import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../signals";
import { subscribe } from '../../subscribe/subscribe';

/**
 * Transforms each emitted value from the source `Signal<T>` into an inner `Signal<V>`
 * using the provided `project` function, and mirrors only the most recently created
 * inner signal’s values in the output.
 *
 * Each projected signal is created within its own child cleanup scope, which is
 * disposed when the source signal emits a new value, ensuring proper cleanup of
 * previous inner signals.
 *
 * @param project
 * A function that maps each defined value from the source signal
 * to a new inner signal whose values will be reflected in the output.
 * Values of `undefined` are ignored.
 *
 * @returns A signal operator function that emits values from the most recent inner signal.
 *
 * @example
 * ```ts
 * const userId = signal(1);
 *
 * const userDetails = signalPipe(
 *   userId,
 *   [ switchMap(id => createUserDetailsSignal(id)) ]
 * );
 * ```
 *
 * @remarks
 * - Each inner signal is created within a separate child cleanup scope.
 * - Only the most recent projected inner signal remains active.
 * - Use this when you want to cancel or replace previous signal computations
 *   whenever the source signal emits a new value.
 * - Values of `undefined` from the source signal are skipped.
 */
export function switchMap<T, V>(project: (value: Exclude<T, undefined>) => Signal<V>): SignalOperatorFunction<T, V> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(switchMap);
    const childScope = CleanupScope.assertCurrent(switchMap).createChild();
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (value) => {
      childScope.cleanup();
      childScope.run(() => {
        const innerSource = project(value);
        subscribe(innerSource, (innerValue) => {
          nextSource.set(innerValue);
        });
      });
    });


    return nextSource.asReadonly();
  }
}
