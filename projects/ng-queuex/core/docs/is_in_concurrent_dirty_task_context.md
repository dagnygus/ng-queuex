## Declaration
```ts
function isInConcurrentDirtyTaskContext(): boolean;
```
Determines that the current stack frame is within concurrent task context and that task is dirty.

**Returns:** True if current stack frame is within concurrent task context and that task is dirty.

See also:
  - [isInConcurrentTaskContext()](./is_in_concurrent_task_context.md).
  - [isInConcurrentCleanTaskContext()](./is_in_concurrent_clean_task_context.md).
  - [assertInConcurrentTaskContext()]('./assert_in_concurrent_task_context.md).
  - [assertInConcurrentCleanTaskContext()](./assert_in_concurrent_clean_task_context.md).
  - [assertInConcurrentDirtyTaskContext()](./assert_in_concurrent_dirty_task_context.md).
