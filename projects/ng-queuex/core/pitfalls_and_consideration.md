## Pitfalls & Considerations ⚠️
While `@ng-queuex/core` is designed to be simple and robust, there are a few important details to be aware of:

### 1.Test Integration Setup 🧪
  - In a real Angular app, just adding provideNgQueuexIntegration() is enough.
  - In tests, however, environment initializers are not triggered, so you must complete the integration manually:
```ts
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideNgQueuexIntegration()],
  });

  TestBed.runInInjectionContext(() => {
    completeIntegrationForTest();
  });
});
```
  - It is important to always rest testing module after each test:
```ts
afterEach(() => {
  TestBed.resetTestingModule();
})
```

### 2.Shared Abort Logic 🔄
Dirty tasks (e.g. those created with `[detectChanges()]` or `scheduleChangeDetection()`) rely on shared abort logic.<br>
This means both the user and the internal coalescing mechanism can trigger abort() for the same task.<br>
The final outcome depends on who aborts first.<br>
When writing tests or advanced integrations, assume that a task might be aborted earlier than expected.<br>
Despite this, the coalescing mechanism is simple to understand. All information is contained in the [detectChanges()](./docs/detect_changes.md) and the [scheduleChangeDetection()](./docs/schedule_change_detection.md) documentation.

### 3.Using whenIdle() in Tests ⏳
whenIdle() is a helper for unit and integration tests that lets you wait until scheduler becomes idle.

#### How it works:
  - by default, it performs **5 polling steps** (microtasks) before resolving,
  - if new tasks appear during this window → the resolver is added to an internal listener array and only runs once the queue stabilizes,
  - you can pass a custom threshold (whenIdle(16)), but the minimum is always 5,
  - works only in supported test runners (Jasmine/Jest) → otherwise, it throws an error.

#### Benefits
  - guarantees tests won’t hang indefinitely,
  - flexible configuration for edge cases,
  - integrates seamlessly with the scheduler logic.

See also **[unit test guideline](./unit_test_guideline.md)**.

### 4. Single-App Limitation (Standalone only) 🏗️
The scheduler in @ng-queuex/core is designed to support **only one Angular application instance per process.**<br>
Multiple attempts to integrate (`provideNgQueuexIntegration()` across multiple SSR/MPA apps) will trigger validation errors. This also applies app to be standalone. NgModule bootstrap will also trigger validation Errors.

### 5. Server-Unfriendly APIs 🌐
Some functions (`scheduleTask()`, `detectChanges()`, `scheduleChangeDetection()`) will deliberately throw when executed on the server.
This is intentional: developers must provide their own SSR fallbacks, just like the ones offered in `@ng-queuex/template`.

##
⚡ Done!
##
