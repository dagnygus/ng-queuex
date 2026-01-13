import { assertNotInReactiveContext, computed, signal } from "@angular/core";
import { NG_DEV_MODE, SignalMonoTypeOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Performs a side effect for each value emitted by the source `Signal<T>`
 * without modifying the value.
 *
 * For every defined value emitted by the source signal, the provided `next`
 * callback is invoked. The original value is then forwarded unchanged to
 * the output signal.
 *
 * @param next
 * A function invoked for each emitted source value to perform side effects.
 *
 * @returns
 * A signal operator function that forwards all source values unchanged.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const logged = signalPipe(
 *   source,
 *   [ tap(value => console.log(value)) ]
 * );
 * ```
 *
 * @remarks
 * - The `next` callback is invoked for side effects only.
 * - Emitted values are not modified or filtered.
 * - Only defined source values trigger the side effect.
 */
export function tap<T>(next: (value: Exclude<T, undefined>) => void): SignalMonoTypeOperatorFunction<T> {
  return function (prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(tap);
    const childScope = CleanupScope.assertCurrent(tap).createChild();
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (value) => {
      childScope.cleanup();
      childScope.run(() => { next(value); });
      nextSource.set(value);
    })

    return nextSource.asReadonly();
  }
}
