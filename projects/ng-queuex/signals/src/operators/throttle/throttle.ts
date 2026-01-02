import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { subscribe } from "../../subscribe/subscribe";
import { audit } from "rxjs";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

export function throttle<T>(durationSelector: () => Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(audit);
    const childScope = CleanupScope.assertCurrent(audit).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let durationNotifier: Signal<any> | null = null;
    let valueToEmit: any;

    subscribe(prevSource, (value) => {
      if (durationNotifier) { return; }
      valueToEmit = value;

      let cleaned = false
      childScope.add(() => {
        cleaned = true;
        durationNotifier = null;
      });

      childScope.run(() => {
        durationNotifier = durationSelector();
        if (cleaned) {
          childScope.cleanup();
          durationNotifier = null;
          return;
        }

        let sync = true
        subscribe(durationNotifier, () => {
          if (sync) { return; }
          nextSource.set(valueToEmit);
          childScope.cleanup();
        });
        sync = false;

        if (cleaned) {
          childScope.cleanup();
        }
      })
    })

    return nextSource.asReadonly();
  }
}
