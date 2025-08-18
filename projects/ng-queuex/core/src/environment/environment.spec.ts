import { TestBed } from "@angular/core/testing"
import { completeIntegrationForTest, Integrator, provideNgQueuexIntegration } from "./environment"
import { Component, createEnvironmentInjector, EnvironmentInjector, Injector, NgModuleRef, OnInit, PLATFORM_ID, provideZonelessChangeDetection, runInInjectionContext, ɵglobal } from "@angular/core";
import { scheduleTask } from "../core";
import { first, firstValueFrom } from "rxjs";

const USAGE_EXAMPLE_IN_UNIT_TESTS =
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
  '});'

const COMMON_MESSAGE =
  '"@ng-queuex/core" is design for projects with standalone angular application where there ' +
  'is only one ApplicationRef instance and with one root bootstrapped component. ' +
  'Integration can not be provided in lazy loaded module but only at application root level ' +
  'and at root injection context of environment injector. Use bootstrapApplication() ' +
  'function with a standalone component. In case of unit tests you need to provide integration ' +
  'to test module and call function completeINtegrationForTest() in TestBed injection context ' +
  'just like example shows: \n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS;

describe('Testing integration.', () => {
  it('Should successfully integrate!', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration()
      ],
    }).runInInjectionContext(() => completeIntegrationForTest());

    expect(Integrator.instance).not.toBeNull();
    expect(Integrator.instance!.isServer).toBeFalse();
    expect(Integrator.instance!.uncompleted).toBeFalse();

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  })

  it('Integrator.instance.isServer should be true for server PLATFORM_ID.', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    }).runInInjectionContext(() => completeIntegrationForTest());

    expect(Integrator.instance!.isServer).toBeTrue();

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

  it('Should not start integrating if method TestBed.runInInjectionContext() was not used.', () => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    })

    expect(Integrator.instance).toBeNull()
    TestBed.resetTestingModule()
  })

  it('Integration should not be completed if function completeIntegrationForTest() was not used in testBed injection context.', () => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    }).runInInjectionContext(() => {});

    expect(Integrator.instance).not.toBeNull();
    expect(Integrator.instance!.isServer).toBeFalse();
    expect(Integrator.instance!.uncompleted).toBeTrue();

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

  it('Should throw error if integration was provided more then once.', () => {
    expect(() => TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    }).runInInjectionContext(() => {
      new Integrator();
    })).toThrowError('provideNgQueuexIntegration(): Integration already provided! ' + COMMON_MESSAGE);

    TestBed.resetTestingModule();
  });

  it('Should throw error when used in a child environment injector (lazy loaded module)', () => {
    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined;

    expect(() => createEnvironmentInjector(
      [
        provideNgQueuexIntegration(),
        { provide: NgModuleRef, useValue: { instance: null } }
      ],
      TestBed.inject(EnvironmentInjector))
    ).toThrowError('provideNgQueuexIntegration(): Integration provided not at root level! ' + COMMON_MESSAGE)

    ɵglobal.jasmine = _jasmine;
    Integrator.instance!.ngOnDestroy();
    Integrator.instance = null;
  });

  it('Should throw error if completeIntegrationForTest() function was used not in TestBed injection context', () => {
    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()],
    }).runInInjectionContext(() => {});

    const injector = Injector.create({ providers: [], parent: TestBed.inject(EnvironmentInjector) })

    expect(() => runInInjectionContext(injector, () => {
      completeIntegrationForTest();
    })).toThrowError(
      'completeIntegrationForTest(): Incorrect function usage. This function can be used only in TestBed injection context.' +
      'The correct usage of this function is illustrated in the following example:\n\n' + USAGE_EXAMPLE_IN_UNIT_TESTS
    );

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

  it('Should delay app initial stabilization if there are concurrent tasks in queue.', async () => {
    const log: string[] = [];

    @Component({
      selector: 'some-cmp',
      template: '<span>Hello from Some Component</span>',
      standalone: true
    })
    class SomeComponent implements OnInit {
      ngOnInit(): void {
        scheduleTask(() => log.push('A'));
        scheduleTask(() => log.push('B'));
        scheduleTask(() => log.push('C'));
      }
    }

    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        provideZonelessChangeDetection(),
        { provide: NgModuleRef, useValue: { instance: null } }
      ]
    }).runInInjectionContext(() => {});
    ɵglobal.jasmine = _jasmine;

    expect(Integrator.instance!.uncompleted).toBeFalse();

    const appRef = Integrator.instance!.appRef
    const subscription = appRef.isStable.subscribe((value) => {
      if (value) {
        log.push('D')
      }
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    appRef.bootstrap(SomeComponent, host);

    await firstValueFrom(appRef.isStable.pipe(first((value) => value)));

    expect(log).toEqual(['A', 'B', 'C', 'D']);
    expect(Integrator.instance!.bootstrapCount).toBe(1);
    subscription.unsubscribe();
    TestBed.resetTestingModule();
    host.remove();
    expect(Integrator.instance).toBeNull();
  });

  it('Should throw an error if not standalone component is bootstrapped', () => {

    @Component({
      selector: 'some-cmp',
      template: '<span>Hello from Some Component</span>',
      standalone: false
    })
    class SomeComponent {}

    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        { provide: NgModuleRef, useValue: { instance: null } }
      ]
    }).runInInjectionContext(() => { });
    ɵglobal.jasmine = _jasmine;

    expect(Integrator.instance!.uncompleted).toBeFalse();

    const appRef = Integrator.instance!.appRef;

    const host = document.createElement('div');
    document.body.appendChild(host);

    expect(() => appRef.bootstrap(SomeComponent, host))
      .toThrowError(
        'provideNgQueuexIntegration(): Application bootstrap with NgModule is not supported! '+
        'Use a standalone component instead.' + COMMON_MESSAGE
      );

    TestBed.resetTestingModule();
    host.remove();
    expect(Integrator.instance).toBeNull();
  });

  it('Should throw error if more then one component is bootstrapped.', () => {

    @Component({
      selector: 'first-some-cmp',
      template: '<span>Hello from Fist Some Component</span>',
      standalone: true
    })
    class FirstSomeComponent {}

    @Component({
      selector: 'second-some-cmp',
      template: '<span>Hello from Second Some Component</span>',
      standalone: true
    })
    class SecondSomeComponent {}

    const _jasmine = ɵglobal.jasmine;
    ɵglobal.jasmine = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        { provide: NgModuleRef, useValue: { instance: null } }
      ]
    }).runInInjectionContext(() => { });
    ɵglobal.jasmine = _jasmine;

    expect(Integrator.instance!.uncompleted).toBeFalse();

    const appRef = Integrator.instance!.appRef;
    const hostOne = document.createElement('div');
    const hostTwo = document.createElement('div');

    document.body.appendChild(hostOne)
    document.body.appendChild(hostTwo)

    appRef.bootstrap(FirstSomeComponent, hostOne);

    expect(() => appRef.bootstrap(SecondSomeComponent, hostTwo))
    .toThrowError('provideNgQueuexIntegration(): Multiple components were bootstrapped, which is not allowed! ' + COMMON_MESSAGE);


    TestBed.resetTestingModule();
    hostOne.remove();
    hostTwo.remove();
    expect(Integrator.instance).toBeNull();
  });

  it('Should throw error if detect module base application', () => {

    TestBed.configureTestingModule({
      providers: [provideNgQueuexIntegration()]
    });

    expect(() => {
      TestBed.runInInjectionContext(() => {
        Integrator.instance!.assertProject();
      })
    })
    .toThrowError(
      'provideNgQueuexIntegration(): Non-standalone application detected. ' +
      'This library only supports Angular applications bootstrapped with standalone APIs. ' +
      'It seems that your application is still using the traditional NgModule-based ' +
      'bootstrap (e.g. platformBrowserDynamic().bootstrapModule(AppModule)).'
    )

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

});
