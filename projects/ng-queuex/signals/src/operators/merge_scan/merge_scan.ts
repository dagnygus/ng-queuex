import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Accumulates source values into a result signal by projecting each value
 * into an accumulator signal and merging all accumulator signals.
 *
 * For each value emitted by the source `Signal<T>`, the `accumulator`
 * function is invoked with the current accumulated state and the source
 * value, producing a new `Signal<R>`. All accumulator signals remain
 * active concurrently, and every emission from any of them updates the
 * accumulated result.
 *
 * The accumulation starts with the provided `seed` value.
 *
 * @param accumulator
 * A function that maps the current accumulated value and a source value
 * to a signal producing updated accumulated values.
 *
 * @param seed
 * The initial accumulated value.
 *
 * @returns
 * A signal operator function that emits accumulated values produced by
 * all active accumulator signals.
 *
 * @example
 * ```ts
 * const source = signal(1);
 *
 * const accumulated = signalPipe(
 *   source,
 *   [
 *     mergeScan((acc, value) => createAccumulatorSignal(acc, value), 0)
 *   ]
 * );
 * ```
 *
 * @remarks
 * - All accumulator signals remain active concurrently.
 * - Emissions from any active accumulator signal update the accumulated value.
 * - This operator allows overlapping accumulation processes.
 */
export function mergeScan<R, T>(accumulator: (acc: R, value: Exclude<T, undefined>) => Signal<R>, seed: R): SignalOperatorFunction<T, R> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(mergeScan);
    const scope = CleanupScope.assertCurrent(mergeScan);
    const nextSource = signal<R>(seed);
    const innerSources = new Map<Signal<R>, CleanupScope>();
    let acc = seed;

    subscribe(prevSource, (value) => {
      const childScope = scope.createChild();
      childScope.run(() => {
        let cleaned = false;
        childScope.add(() => { cleaned = true; });
        const innerSource = accumulator(acc, value);

        if (cleaned) {
          const value = innerSource();
          if (typeof value !== 'undefined') {
            acc = value;
            nextSource.set(acc);
          }
          childScope.destroy();
          return;
        }

        const prevChildScope = innerSources.get(innerSource);
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
          acc = v
          nextSource.set(acc);
        });

        if (cleaned) {
          childScope.destroy();
          return;
        }

        childScope.add(() => { childScope.destroy(); });
      })
    })

    return nextSource.asReadonly();
  }
}
