## Declaration
```ts
function isInConcurrentTaskContext(): boolean;
```
Determines that the current stack frame is within concurrent task context.

**Returns:** True if current stack frame is within concurrent task context.

See also:
  - [isInConcurrentCleanTaskContext()](./is_in_concurrent_clean_task_context.md).
  - [isInConcurrentDirtyTaskContext()](./is_in_concurrent_dirty_task_context.md).
  - [assertInConcurrentTaskContext()]('./assert_in_concurrent_task_context.md).
  - [assertInConcurrentCleanTaskContext()](./assert_in_concurrent_clean_task_context.md).
  - [assertInConcurrentDirtyTaskContext()](./assert_in_concurrent_dirty_task_context.md).
