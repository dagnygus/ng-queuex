import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function skipUntil<T>(notifier: Signal<any>): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(skipUntil);
    const childScope = CleanupScope.assertCurrent(skipUntil).createChild();
    const nextSource = signal<T | undefined>(undefined);
    let skip = true;
    let cleared = false;

    subscribe(prevSource, (value) => {
      if (skip) { return; }
      nextSource.set(value);
    });

    let sync = true;
    childScope.add(() => {
      skip = false;
      cleared = true;
      if (sync) { return; }
      childScope.destroy();
    })
    childScope.run(() => {
      subscribe(notifier, () => {
        if (sync) { return; }
        childScope.destroy();
      });
    });
    sync = false;

    if (cleared) {
      childScope.destroy();
    }

    return nextSource.asReadonly();
  }
}
