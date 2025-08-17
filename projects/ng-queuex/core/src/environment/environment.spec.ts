import { TestBed } from "@angular/core/testing"
import { Integrator, provideNgQueuexIntegration } from "./environment"
import { noopFn } from "../scheduler/scheduler_utils";
import { Injector, PLATFORM_ID } from "@angular/core";

describe('Testing integration.', () => {
  it('Should successfully integrate!', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration()
      ],
    });
    TestBed.runInInjectionContext(() => {});

    expect(Integrator.instance).not.toBeNull();
    expect(Integrator.instance!.isServer).toBeFalse();

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  })

  it('Integrator.instance.isServer should be true.', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    }).runInInjectionContext(noopFn);

    expect(Integrator.instance!.isServer).toBeTrue();

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

  // it('Some dummy test', () => {
  //   TestBed.configureTestingModule({
  //     providers: [
  //       provideNgQueuexIntegration()
  //     ],
  //   });
  //   TestBed.runInInjectionContext(() => {
  //     //@ts-expect-error private member
  //     expect(Integrator.instance._appRef.injector).toEqual(TestBed.inject(Injector));
  //   });

  //   TestBed.resetTestingModule();
  // })
});
