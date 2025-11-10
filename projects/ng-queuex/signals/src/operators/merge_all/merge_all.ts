import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Flattens a higher-order signal by merging the values from all inner signals
 * emitted by the source, emitting each inner value as it arrives.
 *
 * Unlike {@link switchAll}, previously emitted inner signals remain active and
 * continue to contribute values to the output until they complete or stop emitting.
 * Values of `undefined` from the source signal are ignored.
 *
 * @returns
 * A signal operator function that emits values from all currently active inner signals.
 *
 * @example
 * ```ts
 * const innerA = signal(1);
 * const innerB = signal(2);
 * const higherOrder = signal(innerA);
 *
 * const merged = signalPipe(
 *   higherOrder,
 *   mergeAll()
 * );
 *
 * // Emits 1 from innerA
 * higherOrder.set(innerB);
 * // Emits values from both innerA and innerB concurrently
 * ```
 *
 * @remarks
 * - All active inner signals are observed concurrently.
 * - Use this when you want to combine emissions from multiple inner signals without cancelling previous ones.
 * - Values of `undefined` from the source signal are skipped.
 */
export function mergeAll<T, U extends Signal<T> | undefined = Signal<T> | undefined>(): SignalOperatorFunction<U, undefined extends U ? T | undefined : T> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(mergeAll);
    const scope = CleanupScope.assertCurrent(mergeAll);
    const nextSource = signal<any>(undefined);
    const innerSources = new Set<Signal<T>>();

    scope.add(() => {
      innerSources.clear();
    })

    subscribe(prevSource, (innerSource) => {
      if (innerSources.has(innerSource)) {
        return;
      }

      innerSources.add(innerSource)

      const childScope = scope.createChild();
      let cleaned = false;
      childScope.add(() => {
        innerSources.delete(innerSource);
        cleaned = true;
      });

      childScope.run(() => {
        subscribe(innerSource, (value) => {
          nextSource.set(value);
        });
      });

      if (cleaned) {
        childScope.cleanup();
      }
    });

    return nextSource.asReadonly();
  }
}
