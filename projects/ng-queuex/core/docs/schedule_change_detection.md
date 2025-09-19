## Overloads
```ts
function scheduleChangeDetection(callback: VoidFunction): AbortTaskFunction;
function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: null): AbortTaskFunction;
function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef): AbortTaskFunction | null;
function scheduleChangeDetection(callback: VoidFunction, priority: PriorityLevel, cdRef: ChangeDetectorRef | null): AbortTaskFunction | null;
```

### Description
Schedules a task with default priority (`Priority.Normal`) (or with provided priority as argument) and with provided callback which will be executed. The main difference
from `scheduleTask()` is that it is involved internal coalescing mechanism. Consider to use `detectChangesSync()` function to
improve coalescing. The example below illustrates how coalescing works.
```ts
private _cdRef = inject(ChangeDetectionRef);
 
public onButtonClick(): void {
  scheduleChangeDetection(() => {
  detectChangesSync(this._cdRef); //This line will trigger change detection. returns true.
  detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
  detectChangesSync(this._cdRef); //This line not trigger change detection. returns false.
  });
}
```
As you can see, in concurrent task execution context you can trigger change detection once. With ```detectChanges()``` function
used side by side, there is a situation where coalescing will appear.
```ts
scheduleChangeDetection(() => {
  // This call will abort task created bellow, because that task doesn't have a higher priority
  detectChangesSync(this._cdRef);
  });

detectChanges(this._cdRer); // Task successfully scheduled, but will be aborted
```
However if you provide higher priority to `detectChanges()` function, coalescing will failed and change detection will be triggered twice.
 ```ts
//This task has default Priority.Normal.
  scheduleChangeDetection(() => {
    detectChangesSync(this._cdRef); // This call will trigger change detection.
  });
  // Task successfully scheduled and will be execute earlier then task from above.
  detectChanges(this._cdRer, Priority.High);
 ```
For same priorities, coalescing will also failed if you change execution order.
 ```ts
//Task successfully scheduled and will be executed earlier then task below.
detectChanges(this._cdRer);

scheduleChangeDetection(() => {
    detectChangesSync(this._cdRef); // This call will trigger change detection.
});
 ```
To improve coalescing for these unfavorable scenarios, provide `cdRef` to `scheduleChangeDetection()` function,
as a third argument.
```ts
scheduleChangeDetection(() => {
  detectChangesSync(this._cdRef);
}, Priority.Normal, this._cdRef);

detectChanges(this._cdRef);
```
Task in witch is involved coalescing system of change detection is called `dirty task`. In contrast task created with
function `scheduleTask()` is called `clean task`. `Clean task` can be aborted only by function returned by `scheduleTask()`.
Regardless of what tasks we are dealing with, it is possible always to add or even remove abort listener.

```ts
const abort = scheduleTask(() => {});

const abortListener () => {};

abort.addAbortListener(abortListener);

// later
abort.removeAbortListener(abortListener);
```

**Params:**
  - `callback` - Concurrent task callback.
  - `priority` (optional) - Task priority.
  - `cdRef` (optional) - An object of type `ChangeDetectorRef` what will be potentially consumed in callbacks body or null.

**Returns:**: Abort task function if task was successfully scheduled. Null if change detection was coalesced.<br>
**Throws:** `Error` if integration was not provided.<br>
**Throws:** `Error` if is server environment.<br>
**Throws:** `Error` if integration for unit test is not completed.<br>

See also:
  - [AbortTaskFunction](./abort_task_function.md).
  - [PriorityLevel](./priority_level.md).
  - [PriorityName](./priority_name.md).
  - [scheduleTask()](./schedule_task.md).
  - [detectChanges()](./detect_changes.md).
  - [detectChangesSync()](./detect_changes_sync.md).
  - [isInConcurrentTaskContext](./is_in_concurrent_task_context.md).
  - [isInConcurrentDirtyTaskContext](./is_in_concurrent_dirty_task_context.md).
  - [assertInConcurrentTaskContext](./assert_in_concurrent_task_context.md).
  - [assertInConcurrentDirtyTaskContext](./assert_in_concurrent_dirty_task_context.md).
