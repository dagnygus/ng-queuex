## Declaration
```ts
function isTaskQueueEmpty(): boolean;
```
Determines that there is any tasks object in queue. If there is at least one task of any status (executed, executing, pending, aborted) it returns false.
Otherwise return true. This functions can be used in supported test runners (jest/jasmine). If any of mentioned test runners will be not detected, it will
throw an error.

See also [whenIdle()](./when_idle.md)
