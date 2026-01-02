import { assertNotInReactiveContext, Signal, signal } from "@angular/core";
import { subscribe } from "../../subscribe/subscribe";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

/**
 * Accumulates values from the source signal by projecting each emission into
 * an inner `Signal<R>` and switching to it, emitting values only from the
 * most recently created inner signal.
 *
 * For each source emission, the `accumulator` function is called with the
 * current accumulated value and the emitted source value. The returned
 * inner signal becomes the active accumulator source, replacing any
 * previously active one.
 *
 * @param accumulator
 * A function that maps the current accumulated value and a source emission
 * to an inner signal producing the next accumulated values.
 *
 * @param seed
 * The initial accumulated value used before the first source emission.
 *
 * @returns
 * A signal operator function that emits accumulated values from the most
 * recently projected inner signal.
 *
 * @example
 * ```ts
 * const source = signal<number | undefined>(undefined);
 *
 * const result = signalPipe(
 *   source,
 *   switchScan((acc, value) => createAccumulationSignal(acc, value), 0)
 * );
 * ```
 *
 * @remarks
 * - Only the latest projected inner signal is observed; previous inner
 *   signals are no longer observed once a new one is created.
 * - Accumulated values are emitted synchronously as the active inner
 *   signal updates.
 * - Source emissions with `undefined` never reach the accumulator.
 * - Once the source emits a defined value, it cannot revert to `undefined`.
 */
export function switchScan<R, T>(accumulator: (acc: R, value: Exclude<T, undefined>) => Signal<R>, seed: R): SignalOperatorFunction<T, R> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(switchScan);
    const childScope = CleanupScope.assertCurrent(switchScan).createChild();
    const nextSource = signal<R>(seed);
    let acc = seed;

    subscribe(prevSource, (value) => {
      childScope.cleanup();
      childScope.run(() => {
        let cleaned = false;
        childScope.add(() => { cleaned = true; });
        const innerSource = accumulator(acc, value);

        if (cleaned) {
          acc = innerSource()
          if (typeof acc !== 'undefined') {
            nextSource.set(acc);
          }
          childScope.cleanup();
          return;
        }

        subscribe(innerSource, (innerValue) => {
          acc = innerValue;
          nextSource.set(acc);
        });

        if (cleaned) {
          childScope.cleanup();
        }
      });
    });


    return nextSource.asReadonly();
  }
}
