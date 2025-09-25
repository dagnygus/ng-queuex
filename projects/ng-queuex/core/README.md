# @ng-queuex/core

`@ng-queuex/core` is the foundation of the Queuex ecosystem.
It provides a minimal and direct API for scheduling tasks and coordinating Angular’s change detection.

Unlike other solutions (e.g. RxAngular), it avoids extra abstraction layers such as services or RxJS operators. Instead, it exposes a handful of direct functions that interact directly with the task scheduler and Angular Signals. This design keeps the library:

- **Lightweight** – no hidden indirection, no extra runtime overhead.
- **Predictable** – scheduling and change detection happen exactly when you ask.
- **Hydration-friendly** – queued tasks delay the first ApplicationRef.onStable until the app is truly idle.
- **SSR-aware** – scheduling functions throw during server rendering, so you stay in control of providing fallbacks.

At its core, `@ng-queuex/core` lets you:

- Schedule clean tasks (abortable, priority-based).
- Trigger dirty tasks tied to Angular’s change detection with built-in coalescing.
- Write async-friendly tests that integrate naturally with the scheduler.

## Installation

```bash
npm install https://github.com/dagnygus/ng-queuex/releases/download/v0.0.4/ng-queuex-core-0.0.4.tgz
```

## Getting started

Go to `<project-root>/src/app/app.config.ts` and add `provideNgQueuexIntegration()` to providers.
```ts
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withIncrementalHydration } from '@angular/platform-browser';
import { provideNgQueuexIntegration } from "@ng-queuex/core";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // But avoid using package tools in lazy hydrated component. I am not able to predict the results because of lack of understanding how incremental hydration works.
    provideClientHydration(withEventReplay(), withIncrementalHydration()),
    provideNgQueuexIntegration()// This line will unlock functions like scheduleTask(() => {}) or detectChanges(cdRef)
  ]
}
```
Create a helper class in file `view-refresher.ts`
```ts
import { inject, ChangeDetectorRef, DestroyRef, PLATFORM_ID } from "@angular/core";
import { isPlatformServer } from "@angular/common";
import { detectChanges, Priority, PriorityLevel, AbortTaskFunction } from "@ng-queuex/core";

export class ViewRefresher {
  private _isServer = isPlatformServer(inject(PLATFORM_ID))
  private _cdRef = inject(ChangeDetectorRef);
  private _abort: AbortTaskFunction | null;

  constructor(private _defaultPriority: PriorityLevel) {
    if (this._isServer) { return; }
    this._cdRef.detach();
    this._abort = detectChanges(this._cdRef, this._defaultPriority);
    inject(DestroyRef).onDestroy(() => this._abort?.());
  }

  detectChanges(priority?: PriorityLevel): void {
    if (this._isServer) { return; }
    priority = priority ?? this._defaultPriority;
    this._abort = detectChanges(this._cdRef, priority);
  }
}
```

Create a component in file `concurrent-counter.ts`
```ts
import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { ViewRefresher } from "./path/to/view-refresher";
import { Priority } from "@ng-queuex/core";

@Component({
  selector: 'concurrent-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template `
    <span>counter()</span>
    <button (click)="increment()">Increment</button>
    <button (click)="decrement()">Decrement</button>
  `
})
export class ConcurrentCounter {
  private _refresher = new ViewRefresher(Priority.Normal);

  counter = signal(0);

  increment(): void {
    this.counter.update((value) => ++value);
    this._refresher.detectChanges();
  }

  decrement(): void {
    this.counter.update((value) => --value);
    this._refresher.detectChanges();
  }

} 
```
`ConcurrentCounter` component on client side is:
 - isolated (detached form change detection three);
 - managed locally by concurrent scheduler.

On server side this component is manage by angular global change detection cycle for SSR.

## Core concepts

### Concurrent scheduler

`@ng-queuex/core` package brings to Angular a scheduler developed by `Meta` team for `React` frameworks.
In simplified mental model we can describe it as follows:

  1. `scheduleTask()` function is adding task object to queue, which contains a callback to execute and
  that task has been positioned in queue according to its priority.
  2. When first task appears, a queue flush is scheduled with browser native api (e.g `setTimeout()`).
  3. Once the flush begins, tasks will be executed in sequence until the deadline is hit (16 milliseconds).
  4. When deadline is hit, task execution is stopped and queue flush is scheduled again.

This functionality allows browser to repaint content more frequently and brings better user experience. 

As a part of correction, it should be said that for each priority is assigned a expiration time. For those task what are expired
rescheduling mechanism is blocked and they will be executed sequentially without any break.

 - `Priority.Highest` numeric value: 1 , expiration time: 0ms
 - `Priority.High`, numeric value: 2, expiration time: 250ms
 - `Priority.Normal`, numeric value: 3, expiration time: 5s
 - `Priority.Low`, numeric value: 4, expiration time: 10s
 - `Priority.Lowest`, numeric value: 5, never expires.

### Clean task
A clean task is a concurrent task where abortion is manage only by user who created that task.
In `@ng-queuex/core` package clean task can be created with `scheduleTask()` function. This function returns
an abort task function.

### Dirty task
A dirty task is a task where abortion functionality is shared between user and internal coalescing mechanism.
In `@ng-queuex/core` package dirty task can be created with `detectChanges()` function and with `scheduleChangeDetection()`
function. Returned values by those function is not always guarantied to be functions (It can be null also).
It really depends from situation. Learn more form section bellow.

## Coalescing overview

Instead of triggering change detection N times for N updates, Queuex merges them into a single detection pass.
```ts
const abort1 = detectChanges(cdRef);  
const abort2 = detectChanges(cdRef);  
const abort3 = detectChanges(cdRef);  

// All three collapse into one change detection cycle.
```
From above example only fist function call schedules the change detection and only this one returns abort task function. Rest of it just returns null.
```ts
const abort1 = detectChanges(cdRef); // Task scheduled. Returns function.
const abort2 = detectChanges(cdRef); // Scheduling prevented. Returns null.
const abort3 = detectChanges(cdRef); // Scheduling prevented. Returns null.
```
There is also situation where abort task function can be returned more then once.
```ts
detectChanges(cdRef) // Task scheduled with default priority (Priority.Normal). Returns function.
detectChanges(cdRef, Priority.High) //Task Scheduled. Returns function. Previous task is aborted.
```
In this scenario fist task gets aborted by internal coalescing mechanism and function returned form first call
will not have any effects. The rule is simple: If something will be dene sonner, then there is no need to do it again.

### Pitfalls

With usage `scheduleChangeDetection()` function is associated some leakage in the coalescing system. The example below
shows risky situation where component is almost over-rendered (change detection almost trigger twice).

```ts
// This task is scheduled.
scheduleChangeDetection(() => {
  detectChangesSync(cdRef); //This call will abort task from below.
});

detectChanges(cdRef); // This task also is scheduled but will be aborted.
```
But if we change order or if we give `detectChanges()` function higher priority, then component will be over-rendered.
To prevent that from happen it needs to be provided `cdRef` as third argument for `scheduleChangeDetection()` function.

```ts
detectChanges(cdRef); // Task scheduled.

// Scheduling prevented
scheduleChangeDetection(() => {
  detectChangesSync(cdRef);
}, Priority.Normal, cdRef); //Scheduling prevented.
```

It is worth to mention that regardless of what tasks we are dealing with, it is possible always to add or even remove abort listener.

```ts
const abort = scheduleTask(() => {});

const abortListener () => {};

abort.addAbortListener(abortListener);

// later
abort.removeAbortListener(abortListener);
```
## 📜 License

MIT © 2025 — ng-queuex contributors

## Public API

[scheduleTask()](./docs/schedule_task.md)<br>
[scheduleChangeDetection()](./docs/schedule_change_detection.md)<br>
[detectChanges()](./docs/detect_changes.md)<br>
[detectChangesSync()](./docs/detect_changes_sync.md)<br>
[assertInConcurrentTaskContext()](./docs/assert_in_concurrent_task_context.md)<br>
[assertInConcurrentCleanTaskContext()](./docs/assert_in_concurrent_clean_task_context.md)<br>
[assertInConcurrentDirtyTaskContext()](./docs/assert_in_concurrent_dirty_task_context.md)<br>
[isInConcurrentTaskContext()](./docs/is_in_concurrent_task_context.md)<br>
[isInConcurrentCleanTaskContext()](./docs/is_in_concurrent_clean_task_context.md)<br>
[isInConcurrentDirtyTaskContext()](./docs/is_in_concurrent_dirty_task_context.md)<br>
[onTaskExecuted()](./docs/on_task_executed.md)<br>
[whenIdle()](./docs/when_idle.md)<br>
[isTaskQueueEmpty()](./docs/is_task_queue_empty.md)<br>
[provideNgQueuexIntegration()](./docs/provide_ng_queuex_integration.md)<br>
[completeIntegrationForTest()](./docs/complete_integration_for_test.md)<br>
[assertNgQueuexIntegrated()](./docs/assert_ng_queuex_integrated)<br>
[priorityNameToNumber()](./docs/priority_name_to_number.md)<br>
[priorityInputTransform()](./docs/priority_input_transform.md)<br>
[advancePriorityInputTransport()](./docs/advance_priority_input_transform.md)<br>
[sharedSignal()](./docs/shared_signal.md)<br>
[value()](./docs/value.md)<br>
[concurrentEffect()](./docs/concurrent_effect.md)<br>
[AbortTaskFunction](./docs/abort_task_function.md)<br>
[Priority](./docs/priority.md)<br>
[PriorityName](./docs/priority_name.md)<br>
[PriorityLevel](./docs/priority_level.md)<br>
[PriorityInput](./docs/priority_input.md)<br>
[SharedSignalRef](./docs/shared_signal_ref.md)<br>
[ValueRef](./docs/value_ref.md)<br>
[QueuexIterableDiffer](./docs/queuex_iterable_differ.md)<br>
[QueuexIterableDifferFactory](./docs/queuex_iterable_differ_factory)<br>
[QueuexIterableDiffers](./docs/queuex_iterable_differs.md)<br>
[QueuexIterableChangeOperationHandler](./docs/queuex_iterable_change_opration_Handler.md)<br>
[QueuexIterableChanges](./docs/queuex_iterable_changes.md)<br>
[RemovedIterableChangeRecord](./docs/removed_iterable_change_record.md)<br>
[AddedIterableChangeRecord](./added_iterable_change_record.md)<br>
[StillPresentIterableChangeRecord](./docs/still_present_iterable_change_record)


## ❗ Important links
  - 🧪 **[Unit test guideline](./unit_test_guideline.md)**
  - ⚠️ **[Pitfalls & Considerations](./pitfalls_and_consideration.md)**

