## Declaration
```ts
interface ConcurrentEffectOptions {
  priority?: PriorityName,
  manualCleanup?: boolean,
  destroyRef?: DestroyRef,
  allowSignalWrites?: boolean
}
```
Options to configure a concurrent effect created via `concurrentEffect()`.

**Properties:**
  - priority (optional) - Optional priority level (e.g. 'highest' | 'high' |    'normal' | 'low' | 'lowest').
  Determines how soon the scheduled task should be executed by the concurrent scheduler.
  Default is 'normal'
  - manualCleanup (optional) - If `true`, the effect will not automatically register cleanups and must be cleaned up manually.
  - destroyRef (optional) - Optional Angular `DestroyRef` to automatically dispose of the effect when the hosting context is destroyed.
  - allowSignalWrites (optional) - Allows writing to signals within the effect execution context. Defaults to `false` for safety.

See also [concurrentEffect()](./concurrent_effect.md).
