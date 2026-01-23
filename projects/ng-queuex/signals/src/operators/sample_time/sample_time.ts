import { assertNotInReactiveContext, signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { Schedulers } from "../../schedulers/schedulers";
import { subscribe } from "../../subscribe/subscribe";

export function sampleTime<T>(duration: number): SignalOperatorFunction<T, T | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(sampleTime);
    const scope = CleanupScope.assertCurrent(sampleTime);
    const schedulers = scope.getService(Schedulers);
    const nextSource = signal<T | undefined>(undefined);
    let latestValue: T | undefined;

    subscribe(prevSource, (value) => { latestValue = value; });

    const intervalCleanup = schedulers.setInterval(() => {
      if (typeof latestValue === 'undefined') { return; }
      nextSource.set(latestValue);
      latestValue = undefined;
    }, duration);

    scope.add(intervalCleanup);

    return nextSource.asReadonly();
  }
}
