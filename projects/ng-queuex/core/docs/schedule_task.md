## Overloads
```ts
scheduleTask(callback: VoidFunction): AbortTaskFunction;
scheduleTask(callback: VoidFunction, priority: PriorityLevel): AbortTaskFunction;
```
### Description
Schedules a task with provided callback witch will be executed. Task created with that function is called `clean task`.
That means there is not involved any coalescing system related to change detection, and that task can be aborted only by
function returned by `scheduleTask()`. If you want to know more about difference between `clean task` and
`dirty task` , read a description of `scheduleChangeDetection()` function.

**Params:**
  - `callback` - A function what will be executed.
  - `priority` (optional) - A task priority level (options: 1 | 2 | 3 | 4 | 5);

The easiest way to provide priority import enum [Priority](./priority.md) which contains all options.
See also:
 - [AbortTaskFunction](./abort_task_function.md).
 - [PriorityLevel](./priority_level.md).
 - [PriorityName](./priority_name.md).
 - [detectChanges()](./detect_changes.md).
 - [detectChangesSync](./detect_changes_sync.md)
 - [scheduleChangeDetection()](./schedule_change_detection.md).
 - [isInConcurrentTaskContext](./is_in_concurrent_task_context.md).
 - [isInConcurrentCleanTaskContext](./is_in_concurrent_clean_task_context.md).
 - [assertInConcurrentTaskContext](./assert_in_concurrent_task_context.md).
 - [assertInConcurrentCleanTaskContext](./assert_in_concurrent_clean_task_context.md).
