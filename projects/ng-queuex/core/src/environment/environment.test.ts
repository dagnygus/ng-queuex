import { TestBed } from "@angular/core/testing"
import { Integrator, provideNgQueuexIntegration } from "./environment"
import { PLATFORM_ID } from "@angular/core";
import { noopFn } from "../scheduler/scheduler_utils";

describe('Testing integration.', () => {
  it('Should successfully integrate!', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration()
      ],
    });
    TestBed.runInInjectionContext(() => {});

    expect(Integrator.instance).not.toBeNull();
    expect(Integrator.instance!.isServer).toBe(false);

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });

  it('Integrator.instance.isServer should be true.', () => {
    TestBed.configureTestingModule({
      providers: [
        provideNgQueuexIntegration(),
        { provide: PLATFORM_ID, useValue: 'server' }
      ]
    }).runInInjectionContext(noopFn);

    expect(Integrator.instance!.isServer).toBe(true);

    TestBed.resetTestingModule();
    expect(Integrator.instance).toBeNull();
  });
});
