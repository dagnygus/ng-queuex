## Unit Test Guidelines for @ng-queuex/core
Testing code that relies on the `@ng-queuex/core` scheduler requires a slightly different setup than plain Angular unit tests. The scheduler integrates with Angular's change detection lifecycle, so tests must initialize this integration first.

### 1.Integrating with Angular TestBed
When writing integration tests with Angular, you need to explicitly enable the core integration.
This is done in two steps:
  1. Provide the integration with provideNgQueuexIntegration() in the providers array.
  2. Complete the initialization inside TestBed.runInInjectionContext() by calling completeIntegrationForTest().
  3. After each tests make sure that testing module is reset. This is essential for reintegration.
```ts
import { TestBed } from '@angular/core/testing';
import { provideNgQueuexIntegration, completeIntegrationForTest } from '@ng-queuex/testing';

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideNgQueuexIntegration(),
    ]
  }.runInInjectionContext(() => {
    completeIntegrationForTest();
  });
});

afterEach(() => {
  TestBed.resetTestingModule()
})
```
Without these steps, functions like scheduleTask() will throw errors because the scheduler isn't properly registered.

### 2. Waiting for tasks with whenIdle()
The helper function whenIdle(): Promise<void> resolves when the internal task queue becomes empty.
Use it in your tests to wait for the scheduler to settle before making assertions.
```ts
import { whenIdle, scheduleTask } from '@ng-queuex/core';

it('should run scheduled task before idle', async () => {
  let value = 0;
  scheduleTask(() => value = 42);

  await whenIdle();

  expect(value).toBe(42);
});
```
This ensures deterministic tests without race conditions.

### 3. Putting it together: Example Component Test
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { 
  provideNgQueuexIntegration,
  completeIntegrationForTest,
  whenIdle,
  scheduleTask
} from '@ng-queuex/core';

@Component({
  template: `<span>{{ value }}</span>`
})
class TestComponent {
  value = 'initial';
}

describe('TestComponent with @ng-queuex/core', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DummyComponent],
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {
      completeIntegrationForTest();
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule()
  })

  it('should update value after scheduled change detection', async () => {
    const fixture = TestBed.createComponent(TestComponent);
    scheduleTask(() => {
      fixture.componentInstance.value = 'updated';
      fixture.detectChanges();
    });

    await whenIdle();

    expect(fixture.nativeElement.textContent).toContain('updated');
  });
});
```

⚠️ **Note:**
Always call completeIntegrationForTest() in your beforeEach.
Without it, proper environment initializers for test will not run and scheduling will be blocked.
