import { assertNotInReactiveContext, signal } from "@angular/core";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Expands iterable values emitted by the source `Signal` into individual items.
 *
 * When the source signal emits an iterable value, each item of that iterable
 * is forwarded individually to the output signal, in iteration order.
 * If the source emits `undefined`, no items are forwarded.
 *
 * @returns
 * A signal operator function that forwards individual items from emitted
 * iterable values.
 *
 * @example
 * ```ts
 * const source = signal<number[] | undefined>(undefined);
 *
 * const items = signalPipe(
 *   source,
 *   [ each() ]
 * );
 *
 * source.set([1, 2, 3]); // emits 1, then 2, then 3
 * ```
 *
 * @remarks
 * - Each iterable emission is expanded synchronously into individual items.
 * - The iteration order of the iterable is preserved.
 * - `undefined` source values do not produce any output.
 *
 * @throws Error if source iterable contains undefined value.
 */
export function each<T, U extends Iterable<T> | undefined>(): SignalOperatorFunction<U, undefined extends U ? T | undefined : T> {
  return function(prevSource) {
    NG_DEV_MODE && CleanupScope.assertCurrent(each) && assertNotInReactiveContext(each);
    const nextSource = signal<any>(undefined);

    subscribe(prevSource, (items) => {
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          if (NG_DEV_MODE && typeof items[i] === 'undefined') {
            throw new Error('each() operator: Source collection contains undefined value.');
          }
          nextSource.set(items[i]);
        }
      } else {
        for (const item of items) {
          if (NG_DEV_MODE && typeof item === 'undefined') {
            throw new Error('each() operator: Source collection contains undefined value.');
          }
          nextSource.set(item);
        }
      }
    })

    return nextSource.asReadonly();
  }
}
