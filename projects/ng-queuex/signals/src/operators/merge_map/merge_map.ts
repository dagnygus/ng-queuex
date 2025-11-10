import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from '../../subscribe/subscribe';

/**
 * Transforms each emitted value from the source `Signal<T>` into an inner `Signal<V>`
 * using the provided `project` function, and merges all active inner signals into
 * a single flattened `Signal<V>`.
 *
 * Each time the source signal emits a new value, the `project` function is called.
 * The resulting inner signal is subscribed to, and all of its emitted values are
 * reflected in the output signal concurrently with other active inner signals.
 *
 * @param project A function that maps each source value
 * to a new signal whose values will be merged into the output.
 *
 * @returns A signal operator function that merges
 * all projected inner signals into one output signal.
 *
 * @example
 * ```ts
 * const userId = signal(1);
 *
 * const userDetails = signalPipe(
 *   userId,
 *   [
 *     mergeMap(id => createUserDetailsSignal(id))
 *   ]
 * );
 * ```
 *
 * @remarks
 * - Each project() function execution has its own cleanup scope.
 * - All projected inner signals remain active and contribute to the merged output.
 * - Use this when multiple derived signals should emit concurrently into the same stream.
 * - If you want only the most recent projected signal to be active, consider `switchMap`.
 * - Initial value  `undefined` is skipped.
 */
export function mergeMap<T, V>(project: (value: Exclude<T, undefined>) => Signal<V>): SignalOperatorFunction<T, undefined extends T ? V | undefined : V> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(mergeMap);
    const scope = CleanupScope.assertCurrent(mergeMap);
    const nextSource = signal<any>(undefined);
    const innerSources = new Map<Signal<V>, CleanupScope>();

    scope.add(() => {
      innerSources.clear();
    })

    subscribe(prevSource, (value) => {
      const childScope = scope.createChild();
      childScope.run(() => {
        let cleaned = false;
        childScope.add(() => { cleaned = true; });
        const innerSource = project(value);

        if (cleaned) {
          if (typeof nextSource() === 'undefined') {
            nextSource.set(innerSource());
          }
          childScope.cleanup();
          return;
        }

        const prevChildScope = innerSources.get(innerSource)
        if (prevChildScope) {
          prevChildScope.add(() => { childScope.cleanup(); });
          childScope.add(() => { prevChildScope.cleanup(); });
          return;
        }

        innerSources.set(innerSource, childScope);

        childScope.add(() => {
          innerSources.delete(innerSource);
        });

        subscribe(innerSource, (v) => {
          nextSource.set(v);
        });

        if (cleaned) {
          childScope.cleanup();
        }
      })
    });


    return nextSource.asReadonly();
  }
}
