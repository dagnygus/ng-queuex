import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";
import { Schedulers } from "../../schedulers/schedulers";

export function auditTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(auditTime);
    const scope = CleanupScope.assertCurrent(auditTime);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);

    let latestValue: T = undefined!;
    let clearTimeout: (() => void) | null = null;

    scope.add(() => { clearTimeout?.(); })

    subscribe(prevSource, (value) => {
      latestValue = value;

      if (clearTimeout) { return; }

      clearTimeout = schedulers.setTimeout(() => {
        clearTimeout = null;
        nextSource.set(latestValue);
      }, duration);
    });

    return nextSource.asReadonly();
  }
}
