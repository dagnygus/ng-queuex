import { assertNotInReactiveContext, signal, Signal, WritableSignal } from "@angular/core";
import { NG_DEV_MODE, SignalOperatorFunction } from "../../common";
import { CleanupScope } from "../../cleanup_scope/cleanup_scope";
import { subscribe } from "../../subscribe/subscribe";

export function windowToggle<T, O>(openings: Signal<any>, closingSelector: (openValue: Exclude<O, undefined>) => Signal<any>): SignalOperatorFunction<T, Signal<T | undefined> | undefined> {
  return function(prevSource) {
    NG_DEV_MODE && assertNotInReactiveContext(windowToggle);
    const scope = CleanupScope.assertCurrent(windowToggle);
    const windows: WritableSignal<any>[] = [];
    const outputSource = signal<any>(undefined)

    let sync = true
    subscribe(openings, (openValue) => {
      if (sync) { return; }
      const childScope = scope.createChild();
      const win: WritableSignal<any> = signal(undefined);
      let cleaned = false;
      windows.push(win);

      childScope.add(() => {
        cleaned = true;
        const index = windows.indexOf(win);
        windows.splice(index, 1);
      });

      childScope.run(() => {
        const closingNotifier = closingSelector(openValue);

        if (cleaned) {
          childScope.destroy();
          return;
        }

        let sync = true;
        subscribe(closingNotifier, () => {
          if (sync) { return; }
          childScope.destroy();
        });
        sync = false;

        if (cleaned) {
          childScope.destroy();
        }
      });

      if (cleaned) { return; }
      childScope.add(() => childScope.destroy());
      outputSource.set(win.asReadonly());
    });
    sync = false;

    subscribe(prevSource, (value) => {
      for(let i = 0; i < windows.length; i++) {
        windows[i].set(value);
      }
    })

    return outputSource;
  }
}
