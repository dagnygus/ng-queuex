## Declaration
```ts
function assertInConcurrentDirtyTaskContext(message?: string): void;
```
Asserts that the current stack frame is within an concurrent task context and that task is dirty.

**Param:** message (optional) - Error message when assertion failed!.

See also:
  - [assertInConcurrentCleanTaskContext()](./assert_in_concurrent_clean_task_context.md).
  - [assertInConcurrentTaskContext()](./assert_in_concurrent_task_context.md).
  - [isInConcurrentTaskContext()](./is_in_concurrent_task_context.md),
  - [isInConcurrentCleanTaskContext()](./is_in_concurrent_clean_task_context.md).
  - [isInConcurrentDirtyTaskContext()](./is_in_concurrent_dirty_task_context.md).
