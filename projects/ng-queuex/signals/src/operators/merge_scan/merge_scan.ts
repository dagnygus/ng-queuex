import { assertNotInReactiveContext, signal, Signal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function mergeScan<R, T>(accumulator: (acc: R, value: Exclude<T, undefined>) => Signal<R>, seed: R): SignalOperatorFunction<T, R> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(mergeScan);
    const scope = CleanupScope.assertCurrent(mergeScan);
    const nextSource = signal<R>(seed);
    const innerSources = new Map<Signal<R>, CleanupScope>();
    let acc = seed;

    subscribe(prevSource, (value) => {
      const childScope = scope.createChild();
      childScope.run(() => {
        let cleaned = false;
        childScope.add(() => { cleaned = true; });
        const innerSource = accumulator(acc, value);

        if (cleaned) {
          const value = innerSource();
          if (typeof value !== 'undefined') {
            acc = value;
            nextSource.set(acc);
          }
          childScope.destroy();
          return;
        }

        const prevChildScope = innerSources.get(innerSource);
        if (prevChildScope) {
          prevChildScope.add(() => { childScope.cleanup(); });
          childScope.add(() => { prevChildScope.cleanup(); });
          return;
        }

        innerSources.set(innerSource, childScope);

        childScope.add(() => {
          innerSources.delete(innerSource);
        });

        subscribe(innerSource, (v) => {
          acc = v
          nextSource.set(acc);
        });

        if (cleaned) {
          childScope.destroy();
          return;
        }

        childScope.add(() => childScope.destroy())
      })
    })

    return nextSource.asReadonly();
  }
}
