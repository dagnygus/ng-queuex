import { TestBed } from '@angular/core/testing';
import { interval } from "./interval"
import { DestroyableInjector, DestroyRef, Injector } from '@angular/core';
import { createTestCleanupScope, subscribe } from '../signals';

describe('Testing interval function.', () => {

  let injector: DestroyableInjector;
  let destroyRef: DestroyRef;

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

  it('Should throw error if is created outside injection context', () => {
    expect(() => interval(10)).toThrowError()
  });

  it('Should not throw error if injector is provided to options', () => {
    const injector = TestBed.inject(Injector);

    expect(() => interval({ period: 10, injector })).not.toThrowError();
  });

  it('Should not throw error if is created in cleanup scope.', () => {
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    expect(() => scope.run(() => interval(10))).not.toThrowError();
  });

  it('Should start running when first reactive consumer appears', (done) => {
    TestBed.runInInjectionContext(() => {
      const log: number[] = []

      const counter = interval(10);
      const unsubscribe = subscribe(counter, (value) => {
        if (value > 10) {
          expect(log).toEqual([0,1,2,3,4,5,6,7,8,9,10]);
          unsubscribe()
          done();
        }
        log.push(value);
      }, destroyRef);
    });
  });


  it('Should start from provided value and end at provided end value and overflow after that.', (done) => {
      TestBed.runInInjectionContext(() => {
      const log: number[] = []

      const counter = interval(10, -5, 8);
      let count = 0;
      const unsubscribe = subscribe(counter, (value) => {
        count++
        if (count > 15) {
          expect(log).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, -5]);
          unsubscribe()
          done();
        }
        log.push(value);
      }, destroyRef);
    });
  })

});
