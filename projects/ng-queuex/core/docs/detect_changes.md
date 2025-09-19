## Overloads
```ts
function detectChanges(cdRef: ChangeDetectorRef): AbortTaskFunction | null;
function detectChanges(cdRef: ChangeDetectorRef, priority: PriorityLevel): AbortTaskFunction | null;
```
### Description
Schedules a task with default priority (`Priority.Normal`) what will trigger cdRef.detectChanges() method, unless it was schedules earle before with same or higher priority. Under the hood there is coalescing mechanism implement. Lest look at this example.
```ts
private _cdRef = inject(ChangeDetectorRef)

public onButtonClick(): void {
  detectChanges(this._cdRef); // Task successfully scheduled.
  detectChanges(this._cdRef); // Scheduling prevented.
  detectChanges(this._cdRef); // Scheduling prevented.
}
 ```
In example above change detection is coalesced. Lets consider different example with task abortion.
```ts
private _cdRef = inject(ChangeDetectorRef)

public onButtonClick(): void {
  const abort = detectChanges(this._cdRef); // Task successfully scheduled.
  abort() // Task from above is now aborted.
  detectChanges(this._cdRef); // Task successfully scheduled.
  detectChanges(this._cdRef); // Scheduling prevented.
}
 ```
From this now you know how you can delegate change detection to other task. There is also one more scenario when task can be aborted without calling abort function.
```ts
private _cdRef = inject(ChangeDetectorRef)

public onButtonClick(): void {
  detectChanges(this._cdRef); // Task successfully scheduled, but will be aborted.
  detectChanges(this._cdRef); // Scheduling prevented.

  // Previous task is aborted and change detection is rescheduled, to be executed earlier.
  detectChanges(this._cdRef, Priority.High);
}
```
Change detection scheduled with higher priority will abort this one with lower. Regardless of whatever the task gets aborted by you or by internal coalescing mechanism, you can always add or 
remove abort task listener.
```ts
const abortTask = detectChanges(this._cdRef);

const abortListener () => {};

abortTask.addAbortListener(abortListener);

// later
abortTask.removeAbortListener(abortListener);
```

**Params:**
  - `cdRef` - A component `ChangeDetectorRef` or `ViewRef` of the embedded view.
  - `priority` (optional) - Concurrent task execution priority.

**Returns:** Abort task function if change detection was successfully scheduled. Null if change detection was coalesced.<br>
**Throws:** `Error` if integration was not provided.<br>
**Throws:** `Error` if is server environment.<br>
**Throws:** `Error` if integration for unit test is not completed.<br>

See also:
  - [AbortTaskFunction](./abort_task_function.md).
  - [PriorityLevel](./priority_level.md).
  - [PriorityName](./priority_name.md).
  - [scheduleTask()](./schedule_task.md).
  - [scheduleChangeDetection()](./schedule_change_detection.md).
  - [detectChangesSync()](./detect_changes_sync.md).
