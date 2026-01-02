import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function audit<T>(durationSelector: () => Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(audit);
    const childScope = CleanupScope.assertCurrent(audit).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let durationNotifier: Signal<any> | null = null;
    let latestValue: any;

    subscribe(prevSource, (value) => {
      latestValue = value;
      if (durationNotifier) { return; }

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
          nextSource.set(latestValue);
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
