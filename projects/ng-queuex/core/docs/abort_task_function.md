## Declaration
```ts
interface AbortTaskFunction {
  (): void
  addAbortListener(listener: VoidFunction): void;
  removeAbortListener(listener: VoidFunction): void;
}
```
### Description
An interface describing task aborting function. Invoking this function without arguments will abort task. However if you provide a function, it will not abort task but instead it
will set a callback what will run when task gets aborted. If there already is a callback, it will be overridden.

See also:
  - [scheduleTask()](./schedule_task.md).
  - [scheduleChangeDetection()](./schedule_change_detection.md).
  - [detectChanges()](./detectChanges.md).
