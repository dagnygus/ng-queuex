import { DestroyableInjector, DestroyRef, Injector } from "@angular/core";
import { timer } from "./timer"
import { fakeAsync, flush, TestBed } from "@angular/core/testing";
import { createTestCleanupScope, subscribe } from "../signals";

describe('Testing timer function.', () => {

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
    expect(() => timer(10)).toThrowError();
  });

  it('Should not throw error if injector is provided to options.', () => {
    expect(() => timer(10, { injector: TestBed.inject(Injector) })).not.toThrowError();
  });

  it('Should not throw error if is created in cleanup scope.', () => {
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    expect(() => {
      scope.run(() => timer(10))
    }).not.toThrowError();
  });

  it('Should change value when provided time in milliseconds will pass.', fakeAsync(() => {
    TestBed.runInInjectionContext(() => {
      const log: number[] = []
      const source = timer(10);
      subscribe(source, (value) => log.push(value), destroyRef);
      expect(log).toEqual([]);
      flush();
      expect(log).toEqual([0]);
    });
  }));

  it('Should change value when provided time will reach provided date.', fakeAsync(() => {
    TestBed.runInInjectionContext(() => {
      const log: number[] = []
      const date = new Date();
      date.setMilliseconds(date.getMilliseconds() + 10);
      const source = timer(date);
      subscribe(source, (value) => log.push(value), destroyRef);
      expect(log).toEqual([]);
      flush();
      expect(log).toEqual([0]);
    });
  }));

  it('Should change value incrementally when provided is period in milliseconds.', (done) => {
    TestBed.runInInjectionContext(() => {
      const log: number[] = [];
      const source = timer(10, 10);
      subscribe(source, (value) => {
        if (value === 10) {
          expect(log).toEqual([0,1,2,3,4,5,6,7,8,9]);
          done();
        }
        log.push(value);
      }, destroyRef);

    })
  });

})
