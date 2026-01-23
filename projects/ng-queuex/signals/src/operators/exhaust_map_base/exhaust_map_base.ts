import { assertNotInReactiveContext, Signal, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function exhaustMapBase<T, V>(project: (value: Exclude<T, undefined>) => Signal<V>, debugFn: Function): SignalOperatorFunction<T, undefined extends T ? V | undefined : V> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(debugFn);
    const childScope = CleanupScope.assertCurrent(debugFn).createChild();
    const nextSource = signal<any>(undefined);

    let innerSource: Signal<any> | null = null;
    let cleaned = false;

    function onCleanup(): void {
      innerSource = null;
      cleaned = true;
    }

    subscribe(prevSource, (value) => {
      if (innerSource) { return; }

      childScope.cleanup();

      childScope.add(onCleanup);

      childScope.run(() => {
        cleaned = false;
        innerSource = project(value);

        if (cleaned) {
          const value = innerSource();
          if (typeof value !== 'undefined') {
            nextSource.set(innerSource());
          }
          childScope.cleanup();
          innerSource = null;
          return;
        }

        subscribe(innerSource, (v) => {
          innerSource = null;
          nextSource.set(v);
        });

        if (cleaned) {
          childScope.cleanup();
        }
      });
    });

    return nextSource.asReadonly();
  }
}
