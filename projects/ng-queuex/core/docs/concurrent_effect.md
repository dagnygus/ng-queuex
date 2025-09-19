## Declaration
```ts
function concurrentEffect(effectFn: (onCleanup: EffectCleanupRegisterFn) => void, options?: ConcurrentEffectOptions): EffectRef;
```
### Description
Creates a concurrent effect — a reactive computation scheduled and coordinated
by the concurrent scheduler from `ng-queuex/core`.

Unlike Angular’s built-in `effect()`, this variant introduces **Priority-based scheduling** (`highest` → `lowest`),

The effect body is executed through a `Watch` that is detached from Angular’s
change detection cycles. Its execution is triggered by the scheduler at the
configured priority level, ensuring deterministic and efficient updates.

**Params:**
  - effectFn - Effect function to execute. Receives a cleanup registration callback `(onCleanup) => { ... }` used to register teardown logic (e.g. clearing timers, unsubscribing observables).
  - options (optional) - effect configuration:
    - `priority`: Scheduler priority (`'highest' | 'high' | 'normal' | 'low' | 'lowest'`).
      Defaults to `'normal'`.
    - `manualCleanup`: If `true`, the effect must be explicitly destroyed.
      Defaults to `false`.
    - `destroyRef`: An Angular `DestroyRef` to hook automatic cleanup into.
      If omitted and `manualCleanup` is `false`, one will be injected.
    - `allowSignalWrites`: Enables writes to signals inside the effect.
      Defaults to `false`.
**Returns:** A reference handle that allows manual destruction of the effect via `effectRef.destroy()`.<br>
**Throws:** If is used in reactive context.<br>
**Throws:** `Error` if integration was not provided.<br>
**Throws:** `Error` if is server environment.<br>
**Throws:** `Error` if integration for unit test is not completed.<br>

### Example
```ts
const ref = concurrentEffect((onCleanup) => {
  const id = setInterval(() => console.log('tick'), 1000);
  onCleanup(() => clearInterval(id));
}, { priority: 'high' });

  // Destroy manually if manualCleanup = true
  ref.destroy();
```

See also [ConcurrentEffectOptions](./concurrent_effect_options.md)
