## Declaration
```ts
function whenIdle(attempts: number = 5): Promise<void>
```
### Description
Waits until the task queue is considered "idle" by repeatedly checking
whether any tasks remain in the `taskQueue`. This is useful in unit tests
to defer assertions or teardown logic until all microtasks have settled.

The function ensures at least 5 microtask passes (or the given number of attempts,
whichever is greater) before resolving, to give time for queued tasks to complete.

If the queue is not empty, the `resolve` callback is added to a shared
`idleResolvers` list to be triggered once the queue clears.

**Param:** attempts - The number of times to check for queue emptiness. Minimum is 5.<br>
**Returns:** A Promise that resolves when the system appears to be idle.<br>
**Throws:** `Error` if supported test runner was not detected (jasmine/jest).<br>

See also [isTaskQueueEmpty](./is_task_queue_empty.md)
