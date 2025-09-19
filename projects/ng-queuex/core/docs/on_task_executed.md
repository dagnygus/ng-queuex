## Declaration
```ts
function onTaskExecuted(listener: VoidFunction): void;
```
Adds additional work to current executing task, still in the same context. Below example illustrates usage of this function.

**Param:** listener - A function what will be invoke right after current task callback.
**Throws:** `Error` if called outside concurrent task context.
