import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { arrayEquals, NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from '../../subscribe/subscribe'

/**
 * Collects values emitted by the source signal into an array until the
 * `closingNotifier` signal emits a new value, at which point the buffered
 * values are emitted as a single array and the buffer is cleared.
 *
 * Each emission from the `closingNotifier` signal triggers the emission of
 * the current buffer (which may be empty if no values were collected since
 * the last notification).
 *
 * The
 *
 * @param closingNotifier
 * A signal whose emissions indicate when to flush and reset the buffer.
 *
 * @returns
 * A signal operator function that emits arrays of collected values each time
 * the `closingNotifier` signal emits.
 *
 * @example
 * ```ts
 * const value = signal<number | undefined>(undefined);
 * const flush = signal<number>(0);
 *
 * const buffered = signalPipe(
 *   value,
 *   [ buffer(flush) ]
 * );
 *
 * value.set(1);
 * value.set(2);
 * flush.update((v) => ++v); // Emits [1, 2]
 * value.set(3);
 * flush.update((v) => ++v); // Emits [3]
 * ```
 *
 * @remarks
 * - Initial `undefined` value is ignored.
 * - Initial value for output signal is an empty array.
 * - The buffer resets after each emission from `closingNotifier`.
 * - Use this to batch signal values based on external triggers.
 * - Buffer with same items set as previous will not be emitted.
 */
export function buffer<T>(closingNotifier: Signal<any>): SignalOperatorFunction<T, Exclude<T, undefined>[]> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(buffer);
    const childScope = CleanupScope.assertCurrent(buffer).createChild();

    let output: Exclude<T, undefined>[] = [];
    const outputSource = signal<Exclude<T, undefined>[]>([], { equal: arrayEquals });
    subscribe(prevSource, (value) => { output.push(value); });

    let cleaned = false;
    childScope.add(() => { cleaned = true; });

    childScope.run(() => {
      let sync = true;
      subscribe(closingNotifier, () => {
        if (sync) { return; }
        outputSource.set(output);
        output = [];
      });
      sync = false;
    });

    if (cleaned) { childScope.cleanup(); }

    return outputSource.asReadonly();
  }
}
