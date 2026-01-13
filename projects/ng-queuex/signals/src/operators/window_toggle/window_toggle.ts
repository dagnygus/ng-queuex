import { assertNotInReactiveContext, signal, Signal, WritableSignal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Opens and closes windowed signals based on emissions from an `openings`
 * signal and dynamically generated closing signals.
 *
 * When the `openings` signal emits a value, a new window signal is created.
 * The `closingSelector` function is called with the emitted opening value
 * to produce a closing signal. When the closing signal emits, the
 * corresponding window signal completes. Multiple window signals can
 * be active concurrently.
 *
 * @param openings
 * A signal whose emissions trigger the creation of new window signals.
 *
 * @param closingSelector
 * A function that returns a closing signal for each opening value.
 *
 * @returns
 * A signal operator function that emits windowed signals. Each window
 * emits values from the source signal until its closing signal emits.
 *
 * @example
 * ```ts
 * const source = signal(0);
 * const openings = signal(0);
 *
 * const windows = signalPipe(
 *   source,
 *   [ windowToggle(openings, openValue => signal(openValue + 1)) ]
 * );
 * ```
 *
 * @remarks
 * - Multiple window signals can be active at the same time.
 * - Values are forwarded to all currently active windows.
 * - Each window closes when its corresponding closing signal emits.
 */
export function windowToggle<T, O>(openings: Signal<any>, closingSelector: (openValue: Exclude<O, undefined>) => Signal<any>): SignalOperatorFunction<T, Signal<T | undefined> | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(windowToggle);
    const scope = CleanupScope.assertCurrent(windowToggle);
    const windows: WritableSignal<any>[] = [];
    const outputSource = signal<any>(undefined)

    let sync = true
    subscribe(openings, (openValue) => {
      if (sync) { return; }
      const childScope = scope.createChild();
      const win: WritableSignal<any> = signal(undefined);
      let cleaned = false;
      windows.push(win);

      childScope.add(() => {
        cleaned = true;
        const index = windows.indexOf(win);
        windows.splice(index, 1);
      });

      childScope.run(() => {
        const closingNotifier = closingSelector(openValue);

        if (cleaned) {
          childScope.destroy();
          return;
        }

        let sync = true;
        subscribe(closingNotifier, () => {
          if (sync) { return; }
          childScope.destroy();
        });
        sync = false;

        if (cleaned) {
          childScope.destroy();
        }
      });

      if (cleaned) { return; }
      childScope.add(() => { childScope.destroy(); });
      outputSource.set(win.asReadonly());
    });
    sync = false;

    subscribe(prevSource, (value) => {
      for(let i = 0; i < windows.length; i++) {
        windows[i].set(value);
      }
    })

    return outputSource;
  }
}
