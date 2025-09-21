import type { Subscription } from "rxjs"
import type { scheduleTask, scheduleChangeDetection, detectChanges, detectChangesSync } from "../instructions/instructions"
import { isPlatformServer } from "@angular/common";
import {
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  assertInInjectionContext,
  ComponentRef,
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  Injectable,
  Injector,
  makeEnvironmentProviders,
  NgModuleRef,
  OnDestroy,
  PendingTasks,
  PLATFORM_ID,
  provideEnvironmentInitializer,
  reflectComponentType,
} from "@angular/core";
import { internalIsTaskQueueEmpty, setOnIdle } from "../scheduler/scheduler";
import { TestBed } from "@angular/core/testing";

declare const ngDevMode: boolean | undefined;
declare const jest: any;
declare const jasmine: any;

export const USAGE_EXAMPLE_IN_UNIT_TESTS =
  'beforeEach(() => {\n' +
  ' TestBed.configureTestingModule({\n' +
  '   providers: [\n' +
  '     provideNgQueuexIntegration()\n' +
  '   ]\n' +
  ' }).runInInjectionContext(() => {\n' +
  '   completeIntegrationForTest();\n' +
  ' });\n'
  '});\n' +
  'afterEach(() => {\n' +
  ' TestBed.resetTestingModule(); //Dispose integration between tests\n' +
  '});';

export const INTEGRATION_NOT_PROVIDED_MESSAGE =
  '"@ng-queuex/core" integration was not provided to Angular! ' +
  'Use provideNgQueuexIntegration() function to in bootstrapApplication() function ' +
  'to add crucial environment providers for integration.';

export const SERVER_SIDE_MESSAGE = 'Scheduling concurrent tasks on server is not allowed!'
export const INTEGRATION_NOT_COMPLETED_MESSAGE =
  '"@ng-queuex/core" integration for tests is not competed. To make sure that integration is finalized ' +
  'use \'completeIntegrationForTest()\' function inside TestBed injection context as the example below shows:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS

const COMMON_MESSAGE =
'"@ng-queuex/core" is design for projects with standalone angular application where there ' +
'is only one ApplicationRef instance and with one root bootstrapped component. ' +
'Integration can not be provided in lazy loaded module but only at application root level ' +
'and at root injection context of environment injector. Use bootstrapApplication() ' +
'function with a standalone component. In case of unit tests you need to provide integration ' +
'to test module and call function completeINtegrationForTest() in TestBed injection context ' +
'just like example shows: \n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS;


@Injectable({ providedIn: 'root' })
export class Integrator implements OnDestroy {
  public appRef = inject(ApplicationRef);
  public pendingNgTasks = inject(PendingTasks);
  public pendingNgTaskCleanup: (() => void) | null = null;
  public bootstrapCount = 0;
  public uncompleted = true;
  public testEnv = false;
  public isServer = isPlatformServer(inject(PLATFORM_ID));
  public subscription: Subscription | null = null;
  public static instance: Integrator | null = null;

  constructor() {
    if (Integrator.instance) {
      throw new Error(
        'provideNgQueuexIntegration(): Integration already provided! ' + COMMON_MESSAGE
      )
    }
    Integrator.instance = this;
  }

  public assertInRoot(): void {
    if (this.appRef.injector === inject(Injector)) { return; }
    throw new Error(
      'provideNgQueuexIntegration(): Integration provided not at root level! ' + COMMON_MESSAGE
    );
  }

  public assertProject(): void {
    if (inject(NgModuleRef).instance === null) { return; }
    throw new Error(
      'provideNgQueuexIntegration(): Non-standalone application detected. ' +
      'This library only supports Angular applications bootstrapped with standalone APIs. ' +
      'It seems that your application is still using the traditional NgModule-based ' +
      'bootstrap (e.g. platformBrowserDynamic().bootstrapModule(AppModule)).'
    )
  }

  public integrateWithAngular(): void {
    if (this.isServer) {
      this.uncompleted = false;
      return
    }

    this.pendingNgTaskCleanup = this.pendingNgTasks.add();
    setOnIdle(() => {
      this.pendingNgTaskCleanup?.();
      this.pendingNgTaskCleanup = null;
    });
    const subscription = this.subscription = this.appRef.isStable.subscribe((value) => {
      if (value) {
        setOnIdle(null);
        subscription.unsubscribe();
      }
    });
    this.uncompleted = false;
  }

  public onBootstrap(cmpRef: ComponentRef<unknown>): void {
    if (this.isServer) { return; }
    if (this.bootstrapCount >= 1) {
      throw new Error(
      'provideNgQueuexIntegration(): Multiple components were bootstrapped, which is not allowed! ' + COMMON_MESSAGE
      );
    }
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if(!reflectComponentType(cmpRef.componentType)!.isStandalone) {
        throw new Error(
          'provideNgQueuexIntegration(): Application bootstrap with NgModule is not supported! '+
          'Use a standalone component instead.' + COMMON_MESSAGE
        )
      }
    }

    if (++this.bootstrapCount >= this.appRef.components.length && internalIsTaskQueueEmpty()) {
        // During bootstrap there was not scheduled any concurrent task.
        // That means that internal onIdle hook will not be invoke, so we need to cleanup
        // angular pending task manually. That will stabilize application and do rest of the cleanup.
        this.pendingNgTaskCleanup?.()
    }

  }

  ngOnDestroy(): void {
    this.pendingNgTaskCleanup?.();
    this.pendingNgTaskCleanup = null;
    this.subscription?.unsubscribe();
    this.subscription = null;
    Integrator.instance = null;
    setOnIdle(null);
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
      integrator.assertProject();
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
 *  beforeEach(() => {
 *    TestBed.configureTestingModule({
 *      providers: [provideNgQueuexIntegration()]
 *    }).runInInjectionContext(() => {
 *      completeIntegrationForTest();
 *    });
 *  });
 *  afterEach(() => {
 *    TestBed.resetTestingModule() //To dispose integration between tests.
 *  });
 * ```
 * @see {@link provideNgQueuexIntegration}
 */
export function completeIntegrationForTest(): void {
  assertInInjectionContext(() => 'completeIntegrationForTest(): This function was not used in injection context!');

  if (Integrator.instance === null) {
    throw new Error(
      'completeIntegrationForTest(): Integration not provided! To complete integration "@ng-queuex/core" integration for test, ' +
      'provide integration to test module:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS
    )
  }

  const testBedInjector = TestBed.inject(EnvironmentInjector);

  if ((testBedInjector !== inject(Injector)) || Integrator.instance.appRef.injector !== testBedInjector) {
    throw new Error(
      'completeIntegrationForTest(): Incorrect function usage. This function can be used only in TestBed injection context.' +
      'The correct usage of this function is illustrated in the following example:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS
    )
  }

  if (Integrator.instance.uncompleted) {
    Integrator.instance.uncompleted = false;
    Integrator.instance.testEnv = true;
  } else {
    if (Integrator.instance.testEnv) { return; }
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
  if (Integrator.instance) {
    if (Integrator.instance.uncompleted) {
      message = message ?? 'assertNgQueuexIntegrationProvided(): assertion failed! Integration not completed.';
      throw new Error(message);
    }
    return;
  }
  message = message ?? 'assertNgQueuexIntegrationProvided(): assertion failed! Integration not provided.';
  throw new Error(message);
}
