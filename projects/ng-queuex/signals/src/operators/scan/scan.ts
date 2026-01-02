import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Accumulates values from the source signal over time using the provided
 * accumulator function, emitting each intermediate accumulated result.
 *
 * The accumulation starts with the given `seed` value. Each subsequent
 * emission from the source updates the accumulated state and synchronously
 * emits the new result.
 *
 * @param accumulator
 * A pure function that receives the current accumulated value and the next
 * emitted source value, and returns the next accumulated result.
 *
 * @param seed
 * The initial accumulated value used before the first source emission.
 *
 * @returns
 * A signal operator function that emits the accumulated value after each
 * source emission.
 *
 * @example
 * ```ts
 * const source = signal<number | undefined>(undefined);
 *
 * const sum = signalPipe(
 *   source,
 *   [scan((acc, value) => acc + value, 0)]
 * );
 *
 * sum(); // 0
 * source.set(1); // 1
 * source.set(2); // 3
 * ```
 *
 * @remarks
 * - The `seed` value is available immediately as the initial output.
 * - The accumulator is invoked synchronously for each source emission.
 * - Source emissions with `undefined` never reach the accumulator.
 * - Once the source signal emits a defined value, it cannot revert to `undefined`.
 * - The accumulator function runs in child cleanup scope.
 */
export function scan<T, R>(accumulator: (acc: R, value: Exclude<T , undefined>) => R, seed: R): SignalOperatorFunction<T, R> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(scan);
    const childScope = CleanupScope.assertCurrent(scan).createChild();
    const nextSource = signal<R>(seed);
    let acc = seed;

    subscribe(prevSource, (value) => {
      childScope.run(() => {
        acc = accumulator(acc, value);
        nextSource.set(acc);
      });
    });

    return nextSource.asReadonly();
  }
}
