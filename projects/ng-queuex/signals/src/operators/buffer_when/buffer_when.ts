import { assertNotInReactiveContext, Signal, signal } from "@angular/core";
import { arrayEquals, NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Collects values emitted by the source `Signal<T>` into arrays (buffers)
 * and emits each buffer whenever the `Signal` returned by the provided
 * `closingSelector` will change.
 *
 * A new buffer is opened only when the source signal emits a value while
 * no buffer is currently active. At that moment, the `closingSelector`
 * is invoked to create a `Signal` whose emission will close and emit
 * the current buffer.
 *
 * The first emitted value is always an empty array (`[]`), representing
 * the initial state before any source values are collected.
 *
 * @param closingSelector
 * A factory function returning a `Signal` that determines when the current
 * buffer should be closed. Each time this signal emits, the buffer is flushed
 * and a new one will start upon the next source emission.
 *
 * @returns
 * A signal operator function that emits buffered arrays of collected values
 * whenever the associated closing signal emits.
 *
 * @example
 * ```ts
 * const clicks = signal(0);
 * const closingSignal = signal(false);
 *
 * const buffered = signalPipe(
 *   clicks,
 *   [ bufferWhen(() => closingSignal) ]
 * );
 *
 * // Each new buffer starts when `clicks` emits,
 * // and ends when `closingSignal` emits.
 * ```
 *
 * @remarks
 * - Buffers open lazily: only when the source signal emits a value.
 * - The `closingSelector` is called once per active buffer to obtain its closing signal.
 * - Initial `undefined` value is ignored.
 * - Useful for batching values based on dynamically controlled lifecycles.
 * - Buffer with same items set as previous will not be emitted.
 */
export function bufferWhen<T>(closingSelector: () => Signal<any>): SignalOperatorFunction<T, Exclude<T, undefined>[]> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(bufferWhen);
    const childScope = CleanupScope.assertCurrent(bufferWhen).createChild();
    const nextSource = signal<Exclude<T, undefined>[]>([], { equal: arrayEquals });

    let closingNotifier: Signal<any> | null = null;
    let buffer: Exclude<T, undefined>[] = [];

    subscribe(prevSource, (value) => {
      buffer.push(value);

      if (closingNotifier) { return; }

      let cleaned = false;
      childScope.add(() => {
        cleaned = true;
        if (buffer.length) {
          buffer = [];
          closingNotifier = null;
        }
      });

      childScope.run(() => {
        closingNotifier = closingSelector();

        if (cleaned) {
          childScope.cleanup();
          return;
        }

        let sync = true;
        subscribe(closingNotifier!, () => {
          if (sync) { return; }
          nextSource.set(buffer);
          childScope.cleanup();
        });
        sync = false;

        if (cleaned) {
          childScope.cleanup();
        }
      });
    })

    return nextSource.asReadonly();
  }
}
