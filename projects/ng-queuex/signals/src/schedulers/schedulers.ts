import { inject, Injectable, PendingTasks } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class Schedulers {

  private readonly _pendingTasks = inject(PendingTasks);

  allowTaskRegistration = true

  setTimeout(cb: VoidFunction, delay?: number): VoidFunction {
    delay = Math.floor(delay && delay < 0 ? 0 : delay ?? 0);
    const taskCleanup = this.allowTaskRegistration &&  delay === 0  ? this._pendingTasks.add() : null;

    let timeoutId: any = setTimeout(() => {
      cb();
      taskCleanup?.();
      timeoutId = undefined;
    }, delay);
    return function () {
      if (typeof timeoutId === 'undefined') { return; }
      clearTimeout(timeoutId);
      taskCleanup?.();
    }
  }

  setInterval(cb: VoidFunction, timeout?: number) {
    timeout = Math.floor(timeout && timeout < 0 ? 0 : timeout ?? 0);
    let taskCleanup = this.allowTaskRegistration && timeout === 0 ? this._pendingTasks.add() : null;

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
    const taskCleanup = this.allowTaskRegistration ? this._pendingTasks.add() : null;
    let canceled = false

    queueMicrotask(() => {
      if (canceled) { return; }
      cb();
      canceled = true;
      taskCleanup?.();
    })

    return function() {
      if (canceled) { return; }
      taskCleanup?.();
      canceled = true;
    }
  }
}
