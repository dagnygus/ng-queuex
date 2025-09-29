import { fakeAsync, flush, TestBed } from "@angular/core/testing";
import { timeout } from "./timeout";
import { DestroyableInjector, DestroyRef, Injector } from "@angular/core";
import { createTestCleanupScope, subscribe } from "../signals";

describe('Testing timeout function.', () => {

  let injector: DestroyableInjector;
  let destroyRef: DestroyRef

  beforeEach(() => {
    injector = Injector.create({ providers: [] });
    destroyRef = injector.get(DestroyRef);
  });

  afterEach(() => {
    if (!destroyRef.destroyed) {
      injector.destroy();
    }
    injector = null!;
    destroyRef = null!;
  });

  it('Should throw error if is created outside injection context.', () => {
    expect(() => timeout(10, () => 'A')).toThrowError();
  });

  it('Should not throw error if injector is provided in options.', () => {
    expect(() => timeout(10, () => 'A', { injector: TestBed.inject(Injector) }))
      .not.toThrowError();
  });

  it('Should not throw error if is created in cleanup scope.', () => {
    const cleanupScope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    expect(() => {
      cleanupScope.run(() => timeout(10, () => 'A'));
    }).not.toThrowError();
  });

  it('Should change value after provided delay.', fakeAsync(() => {
    TestBed.runInInjectionContext(() => {
      const log: number[] = [];
      const source = timeout(10, (value) => ++value, { initialValue: 0 });
      subscribe(source, (value) => log.push(value), destroyRef);
      expect(log).toEqual([0]);
      flush();
      expect(log).toEqual([0, 1]);
    });
  }));

});
