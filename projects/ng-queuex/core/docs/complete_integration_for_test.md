## Declaration
```ts
function completeIntegrationForTest(): void
```
Finalizes the "@ng-queuex/core" integration inside a TestBed context.

This function must be called when using `provideNgQueuexIntegration()`
within Angular's testing utilities, to ensure all test-related hooks
(Jasmine/Jest detection, schedulers, etc.) are correctly initialized.

Usage example:
```ts
beforeEach(() => {
  TestBed.configureTestingModule({
  providers: [provideNgQueuexIntegration()]
  }).runInInjectionContext(() => {
    completeIntegrationForTest();
  });
});
afterEach(() => {
  TestBed.resetTestingModule() //To dispose integration between tests.
});
 ```

See also:
  - [provideNgQueuexIntegration](./provide_ng_queuex_integration.md).
  - [assertNgQueuexIntegrated](./assert_ng_queuex_integrated.md).
