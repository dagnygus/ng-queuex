import { assertNotInReactiveContext, signal } from "@angular/core";
import { subscribe } from "../../subscribe/subscribe";
import { auditTime } from "rxjs";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { Schedulers } from "../../schedulers/schedulers";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";

export function throttleTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
  return function (prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(auditTime);
    const scope = CleanupScope.assertCurrent(auditTime);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);

    let valueToEmit: T = undefined!;
    let clearTimeout: (() => void) | null = null;

    scope.add(() => { clearTimeout?.(); })

    subscribe(prevSource, (value) => {
      if (clearTimeout) { return; }

      valueToEmit = value;

      clearTimeout = schedulers.setTimeout(() => {
        clearTimeout = null;
        nextSource.set(valueToEmit);
      }, duration);
    });

    return nextSource.asReadonly();
  }
}
