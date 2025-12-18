import { assertNotInReactiveContext, signal, Signal, WritableSignal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { Schedulers } from "../../schedulers/schedulers";
import { subscribe } from "../../subscribe/subscribe";

/**
 * Splits the source signal into time-based windows and emits each window
 * as a dedicated `Signal<T | undefined>`.
 *
 * A new window stays active for the given `windowTimeSpan`. If
 * `windowCreationTime` is provided, new windows are created periodically,
 * allowing overlapping or gapped windows. If `maxWindowSize` is specified,
 * a window closes early once it collects that many defined values.
 *
 * @param windowTimeSpan
 * The duration (in milliseconds) for which each window remains active.
 *
 * @param windowCreationTime
 * The interval (in milliseconds) at which new windows are created.
 * Defaults to the same value as `windowTimeSpan`.
 *
 * @param maxWindowSize
 * Optional maximum number of defined values a window may collect
 * before it closes early.
 *
 * @returns
 * A signal operator that emits new window signals over time.
 *
 * @remarks
 * - Windows emit values from the source while active.
 * - Windows operate independently; overlapping windows produce
 *   overlapping streams of values.
 *
 * @example
 * ```ts
 * const clicks = signal(0);
 *
 * const timedWindows = signalPipe(
 *   clicks,
 *   [ windowTime(1000) ] // each window lasts 1s
 * );
 *
 * // Each emission of `timedWindows` is a new window signal.
 * ```
 */
export function windowTime<T>(windowTimeSpan: number, windowCreationTime?: number, maxWindowSize?: number): SignalOperatorFunction<T, Signal<T | undefined>> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(windowTime);
    const scope = CleanupScope.assertCurrent(windowTime);
    const schedulers = scope.injector.get(Schedulers);
    windowTimeSpan = Math.max(0, windowTimeSpan);
    windowCreationTime = typeof windowCreationTime === 'number' ? Math.max(0, windowCreationTime) : windowTimeSpan;
    maxWindowSize = typeof maxWindowSize === 'number' ? Math.max(1, Math.floor(maxWindowSize)) : undefined;
    const outputSignal = signal<any>(undefined);
    const windows: [WritableSignal<any>, VoidFunction, number][] = [];

    const startWindow = () => {
      let window: [WritableSignal<any>, VoidFunction, number] = [signal(undefined), null!, 0];
      const timeoutCleanup = schedulers.setTimeout(() => {
        scope.remove(timeoutCleanup);
        const index = windows.indexOf(window);
        if (index === -1) { return; }
        windows.splice(index, 1);
      }, windowTimeSpan);

      window[1] = timeoutCleanup;
      windows.push(window);
      scope.add(timeoutCleanup);
      outputSignal.set(window[0].asReadonly());
    }

    startWindow();

    const intervalCleanup = schedulers.setInterval(() => {
      schedulers.allowTaskRegistration = false;
      startWindow();
      schedulers.allowTaskRegistration = true;
    }, windowCreationTime);

    scope.add(intervalCleanup);

    subscribe(prevSource, (value) => {
      for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        const [win, cleanup] = window;

        if (maxWindowSize == null) {
          console.log(win);
          win.set(value)
        } else {
          win.set(value);
          const count = ++window[2];
          if (count === maxWindowSize) {
            windows.splice(i, 1);
            i--;
            cleanup();
            scope.remove(cleanup);
          }
        }

      }
    });

    return outputSignal.asReadonly();
  }
}
