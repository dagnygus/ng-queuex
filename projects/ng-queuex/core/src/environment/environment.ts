import type { scheduleTask, scheduleChangeDetection, detectChanges, detectChangesSync } from "../instructions/instructions"
import { isPlatformServer } from "@angular/common";
import { APP_BOOTSTRAP_LISTENER, ApplicationRef, assertInInjectionContext, ComponentRef, EnvironmentProviders, inject, Injectable, Injector, makeEnvironmentProviders, OnDestroy, PendingTasks, PLATFORM_ID, provideAppInitializer, provideEnvironmentInitializer, reflectComponentType, runInInjectionContext } from "@angular/core";
import { isTaskQueueEmpty, setOnIdle } from "../scheduler/scheduler";
import { TestBed } from "@angular/core/testing";

declare const jasmine: unknown;
declare const jest: unknown;
declare const ngDevMode: boolean | undefined;

const commonMessage =
  '"@ng-queuex/core" is design for projects with standalone angular application where there ' +
  'is only one ApplicationRef instance and with one root bootstrapped component. ' +
  'Integration can not be provided in lazy loaded module but only at application root level ' +
  'and at root injection context of environment injector. Use bootstrapApplication() ' +
  'function with a standalone component.';


@Injectable({ providedIn: 'root' })
export class Integrator implements OnDestroy {
  public appRef = inject(ApplicationRef);
  public pendingNgTasks = inject(PendingTasks);
  public pendingNgTaskCleanup: (() => void) = null!;
  public bootstrapCount = 0;
  public uncompleted = true;
  public isServer = isPlatformServer(inject(PLATFORM_ID));
  public static instance: Integrator | null = null;

  constructor() {
    if (Integrator.instance) {
      throw new Error(
        'provideNgQueuexIntegration(): Integration already provided! ' + commonMessage
      )
    }
    Integrator.instance = this;
  }

  public assertInRoot(): void {
    if (this.appRef.injector === inject(Injector)) { return; }
    throw new Error(
      'provideNgQueuexIntegration(): Integration provided not at root level! ' + commonMessage
    );
  }

  public integrateWithAngular(): void {
    this.pendingNgTaskCleanup = this.pendingNgTasks.add();
    setOnIdle(() => this.pendingNgTaskCleanup());
    const subscription = this.appRef.isStable.subscribe((value) => {
      if (value) {
        setOnIdle(null);
        subscription.unsubscribe();
      }
    });
    this.uncompleted = false;
  }

  public onBootstrap(cmpRef: ComponentRef<unknown>): void {
    if (++this.bootstrapCount > 1) {
      throw new Error(
        'provideNgQueuexIntegration(): Multiple components were bootstrapped, which is not allowed! ' + commonMessage
      );
    }

    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if(!reflectComponentType(cmpRef.componentType)?.isStandalone) {
        throw new Error(
          'provideNgQueuexIntegration(): Application bootstrap with NgModule is not supported! '+
          'Use a standalone component instead.' + commonMessage
        )
      }
    }

    if (++this.bootstrapCount >= this.appRef.components.length && isTaskQueueEmpty()) {
      // During bootstrap there was not scheduled any concurrent task.
      // That means that internal onIdle hook will not be invoke, so we need to cleanup
      // angular pending task manually. That will stabilize application and do rest of the cleanup.
      this.pendingNgTaskCleanup();
    }

  }

  ngOnDestroy(): void {
    Integrator.instance = null;
  }
}

/**
 * @description
 * Provides integration with angular which enables the use of `scheduleTask()` `scheduleChangeDetection()` `detectChanges()` `detectChangesSync()`
 * functions and provides compatibility with hydration if zoneless change detection is provided.
 *
 * In unit tests integration can be provided to test module fallowed by `completeIntegrationForTest()` function called in injection context.
 * The example below illustrates this best.
 *
 * ```ts
 *  beforeEach(() => {
 *    TestBed.configureTestingModule({
 *      providers: []
 *    }).runInInjectionContext(() => {
 *      completeIntegrationForTest();
 *    })
 *  };
 *  afterEach(() => {
 *    TestBed.resetTestingModule(); //To dispose integration between tests
 *  });
 * ```
 *
 * @returns Environment providers
 * @see {@link EnvironmentProviders}
 * @see {@link completeIntegrationForTest}
 * @see {@link scheduleTask}
 * @see {@link scheduleChangeDetection}
 * @see {@link detectChanges}
 * @see {@link detectChangesSync}
 * @see {@link assertNgQueuexIntegrated}
 */
export function provideNgQueuexIntegration(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const integrator = inject(Integrator);
      integrator.assertInRoot();
      if ((typeof jasmine === 'object' && jasmine !== null) || (typeof jest === 'object' && jest !== null)) { return; }
      integrator.integrateWithAngular();
    }),
    {
      provide: APP_BOOTSTRAP_LISTENER,
      multi: true,
      useValue: (cmpRef: ComponentRef<unknown>) => {
        Integrator.instance!.onBootstrap(cmpRef);
      }
    }
  ]);
}

/**
 * Finalizes the "@ng-queuex/core" integration inside a TestBed context.
 *
 * This function must be called when using `provideNgQueuexIntegration()`
 * within Angular's testing utilities, to ensure all test-related hooks
 * (Jasmine/Jest detection, schedulers, etc.) are correctly initialized.
 *
 * Usage example:
 * ```ts
 *  TestBed.configureTestingModule({
 *    providers: [provideNgQueuexIntegration()]
 *    }).runInInjectionContext(() => {
 *    completeIntegrationForTest();
 *  });
 * ```
 * @see {@link provideNgQueuexIntegration}
 */
export function completeIntegrationForTest(): void {
  assertInInjectionContext(() => 'completeIntegrationForTest(): This function was not used in injection context!');

  if (Integrator.instance === null) {
    throw new Error(
      'completeIntegrationForTest(): Integration not provided! To complete integration "@ng-queuex/core" integration for test, ' +
      'provide integration to test module:\n\n' +
      'TestBed.configureTestingModule({\n' +
      ' providers: [\n' +
      '   provideNgQueuexIntegration()\n' +
      ' ]\n' +
      '}).runInInjectionContext(() => {\n' +
      ' completeIntegrationForTest();\n' +
      '});'
    )
  }

  const testBedInjector = TestBed.inject(Injector);

  if ((testBedInjector !== inject(Injector)) || Integrator.instance.appRef.injector !== testBedInjector) {
    throw new Error(
      'completeIntegrationForTest(): Incorrect function usage. This function Can be used only in TestBed injection context.' +
      'The correct usage of this function is illustrated in the following example:\n\n' +
      'TestBed.configureTestingModule({\n' +
      ' providers: [\n' +
      '   provideNgQueuexIntegration()\n' +
      ' ]\n' +
      '}).runInInjectionContext(() => {\n' +
      ' completeIntegrationForTest();\n' +
      '});'
    )
  }

  if (Integrator.instance.uncompleted) {
    Integrator.instance.uncompleted = false;
  } else {
    throw new Error('completeIntegrationForTest(): This function must be called within a test runner (Jasmine/Jest). No test framework detected.')
  }
}

/**
 * @description
 * Asserts that function `provideNgQueuexIntegration()` was used.
 *
 * @param message An error message.
 * @see {@link provideNgQueuexIntegration}
 */
export function assertNgQueuexIntegrated(message?: string): void {
  if (Integrator.instance) { return; }
  message = message ?? 'assertNgQueuexIntegrationProvided(): assertion failed';
  throw new Error(message)
}
