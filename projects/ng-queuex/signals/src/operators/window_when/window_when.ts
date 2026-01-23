import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Opens a new window signal for the source `Signal<T>` each time the
 * previous window closes, with window boundaries determined by a
 * dynamically generated closing signal.
 *
 * When the source signal emits a value and no window is currently active,
 * a new window is opened. The `closingSelector` function is called to
 * obtain a closing signal for the window. When the closing signal emits,
 * the current window completes and a new window can be opened on the next
 * source emission.
 *
 * @template T The type of values emitted by the source signal.
 *
 * @param closingSelector
 * A function that returns a signal controlling when the current window
 * should close.
 *
 * @returns
 * A signal operator function that emits window signals, each collecting
 * source values until its corresponding closing signal emits.
 *
 * @example
 * ```ts
 * const source = signal(0);
 *
 * const windows = signalPipe(
 *   source,
 *   [ windowWhen(() => signal(1)) ]
 * );
 * ```
 *
 * @remarks
 * - A new window opens only after the previous window has closed.
 * - Each window emits source values until its closing signal emits.
 * - Only defined source values are forwarded to the window signals.
 */
export function windowWhen<T>(closingSelector: () => Signal<any>): SignalOperatorFunction<T, Signal<Exclude<T, undefined>> | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(windowWhen);
    const childScope = CleanupScope.assertCurrent(windowWhen).createChild();
    const nextSource = signal<any>(undefined);

    let closingNotifier: Signal<any> | null = null;
    let window = signal<any>(undefined);
    let cleaned = false;

    function onCleanup(): void {
      window = signal(undefined);
      closingNotifier = null;
      cleaned = true;
    }

    subscribe(prevSource, (value) => {
      window.set(value);

      if (closingNotifier) { return; }

      cleaned = false;
      childScope.add(onCleanup);

      childScope.run(() => {
        closingNotifier = closingSelector();

        if (cleaned) {
          childScope.cleanup();
          return;
        }

        let sync = true;
        subscribe(closingNotifier, () => {
          if (sync) { return; }
          childScope.cleanup();
        });
        sync = false;
      });

      if (cleaned) {
        childScope.cleanup();
        return;
      }

      nextSource.set(window.asReadonly());
    });

    return nextSource.asReadonly();
  }
}
