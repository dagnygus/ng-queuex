import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function windowWhen<T>(closingSelector: () => Signal<any>): SignalOperatorFunction<T, Signal<Exclude<T, undefined>> | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(windowWhen);
    const childScope = CleanupScope.assertCurrent(windowWhen).createChild();
    const nextSource = signal<any>(undefined);

    let closingNotifier: Signal<any> | null = null;
    let window = signal<any>(undefined);

    subscribe(prevSource, (value) => {
      window.set(value);

      if (closingNotifier) { return; }

      let cleaned = false;
      childScope.add(() => {
        window = signal(undefined);
        closingNotifier = null;
        cleaned = true;
      });

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
