import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { arrayEquals, NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Collects values emitted by the source `Signal<T>` into one or more buffers,
 * opening a new buffer whenever the `openings` signal emits, and closing
 * that specific buffer when the `Signal` returned by `closingSelector`
 * emits.
 *
 * Multiple buffers may be active at the same time. Each emission from
 * `openings` starts a new independent buffer, and each buffer uses its own
 * closing signal produced by `closingSelector`. When a buffer closes,
 * its collected values are emitted as an array.
 *
 * The first output emitted by this operator is always `[]`, representing
 * the initial empty state before any buffers have collected values.
 *
 *
 * @param openings
 * A signal whose emissions open new buffers. Each emission starts a fresh
 * independent buffer.
 *
 * @param closingSelector
 * A factory function invoked for each newly opened buffer. It returns
 * a signal whose next emission closes and flushes that specific buffer.
 *
 * @returns
 * A signal operator function that emits arrays containing the buffered values
 * collected between each buffer’s opening and closing.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const open = signal(false);
 *
 * const toggled = signalPipe(
 *   source,
 *   [ bufferToggle(open, () => closingSignal) ]
 * );
 *
 * // When `open` emits, a new buffer begins.
 * // When the `closingSignal` returned by closingSelector emits,
 * // that specific buffer is closed and emitted.
 * ```
 *
 * @remarks
 * - Each `openings` emission creates a separate active buffer.
 * - Each buffer has its own independently created closing signal.
 * - Initial `undefined` value is ignored.
 * - Useful for batching values according to externally controlled open/close cycles.
 * - Buffer with same items set as previous will not be emitted.
 */
export function bufferToggle<T>(openings: Signal<any>, closingSelector: () => Signal<any>): SignalOperatorFunction<T, Exclude<T, undefined>[]> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(bufferToggle);
    const scope = CleanupScope.assertCurrent(bufferToggle);
    const nextSource = signal<Exclude<T, undefined>[]>([], { equal: arrayEquals });
    const buffers: Exclude<T, undefined>[][] = [];

    subscribe(prevSource, (value) => {
      for (let i = 0; i < buffers.length; i++) {
        buffers[i].push(value);
      }
    });

    let sync = true;
    subscribe(openings, () => {
      if (sync) { return; }
      const childScope = scope.createChild();
      let buf: Exclude<T, undefined>[] = [];
      let cleaned = false;

      buffers.push(buf);

      childScope.add(() => {
        cleaned = true;
        const index = buffers.indexOf(buf);
        buffers.splice(index, 1);
      });

      childScope.run(() => {
        const closingNotifier = closingSelector();

        if (cleaned) {
          childScope.cleanup();
          return;
        }

        let sync = true;
        subscribe(closingNotifier, () => {
          if (sync) { return; }
          nextSource.set(buf);
          childScope.cleanup();
        });
        sync = false;

        if (cleaned) {
          childScope.cleanup();
        }
      })
    });
    sync = false;

    return nextSource.asReadonly();
  }
}
