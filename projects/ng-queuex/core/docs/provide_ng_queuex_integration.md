## Declaration
```ts
function provideNgQueuexIntegration(): EnvironmentProviders;
```
Provides integration with angular which enables the use of `scheduleTask()` `scheduleChangeDetection()` `detectChanges()` `detectChangesSync()`
functions and provides compatibility with hydration if zoneless change detection is provided.

In unit tests integration can be provided to test module fallowed by `completeIntegrationForTest()` function called in injection context.
The example below illustrates this best.

```ts
beforeEach(() => {
  TestBed.configureTestingModule({
    providers: []
  }).runInInjectionContext(() => {
    completeIntegrationForTest();
  })
};
afterEach(() => {
  TestBed.resetTestingModule(); //To dispose integration between tests
});
```

See also:
  - [completeIntegrationForTest()](./complete_integration_for_test.md).
  - [assertNgQueuexIntegrated()](./assert_ng_queuex_integrated)
