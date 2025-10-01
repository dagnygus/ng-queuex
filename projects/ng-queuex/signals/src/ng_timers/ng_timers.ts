import { inject, Injectable, PendingTasks } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class NgTimers {
  private _pendingTasks = inject(PendingTasks);

  setTimeout(cb: VoidFunction, delay?: number): VoidFunction {
    const taskCleanup = this._pendingTasks.add();
    let timeoutId: any = setTimeout(() => {
      cb();
      taskCleanup();
      timeoutId = undefined;
    }, delay);
    return function () {
      if (typeof timeoutId === 'undefined') { return; }
      clearTimeout(timeoutId);
      taskCleanup();
    }
  }

  setInterval(cb: VoidFunction, timeout?: number) {
    let taskCleanup: VoidFunction | null = this._pendingTasks.add();
    let intervalId: any = setInterval(() => {
      cb();
      taskCleanup?.();
      taskCleanup = null;
    }, timeout);

    return function () {
      clearInterval(intervalId);
      taskCleanup?.();
      taskCleanup = null
    }
  }

  scheduleMicrotask(cb: VoidFunction): VoidFunction {
    const taskCleanup = this._pendingTasks.add();
    let canceled = false

    queueMicrotask(() => {
      cb();
      canceled = true;
      taskCleanup();
    })

    return function() {
      if (canceled) { return; }
      taskCleanup();
      canceled = true;
    }
  }
}
