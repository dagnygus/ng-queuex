import { DestroyableInjector, DestroyRef, Injector } from '@angular/core';
import { fromAsync } from './from_async';
import { subscribe } from '../subscribe/subscribe';
import { Subject } from 'rxjs';

function isPromiseLike<T>(target: any): target is PromiseLike<T> {
  return target != null && typeof target === 'object' && typeof target.then === 'function';
}

class FakePromise<T> implements PromiseLike<T> {
  private fulfilledCallbacks: ((value: T) => any)[] = [];
  private rejectedCallbacks: ((reason: any) => any)[] = [];
  private settled = false;
  private value!: T;
  private reason: any;
  private isRejected = false;

  constructor(private _onThen?: VoidFunction) {}

  resolve(value: T) {
    if (this.settled) return;
    this.settled = true;
    this.value = value;
    for (const cb of this.fulfilledCallbacks) {
      cb(value);
    }
    this.fulfilledCallbacks = [];
    this.rejectedCallbacks = [];
  }

  reject(reason: any) {
    if (this.settled) return;
    this.settled = true;
    this.isRejected = true;
    this.reason = reason;
    for (const cb of this.rejectedCallbacks) {
      cb(reason);
    }
    this.fulfilledCallbacks = [];
    this.rejectedCallbacks = [];
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): FakePromise<TResult1 | TResult2> {
    this._onThen?.();
    const next = new FakePromise<TResult1 | TResult2>();

    if (!this.settled) {
      if (onfulfilled) {
        this.fulfilledCallbacks.push((v) => {
          try {
            const fulfilledResult = onfulfilled(v);
            if (isPromiseLike(fulfilledResult)) {
              fulfilledResult.then((v) => next.resolve(v))
            } else {
              next.resolve(fulfilledResult);
            }
          } catch (err) {
            next.reject(err);
          }
        });
      }
      if (onrejected) {
        this.rejectedCallbacks.push((r) => {
          try {
            const onrejectedResult = onrejected(r);
            if (isPromiseLike(onrejectedResult)){
              onrejectedResult.then((r) => next.resolve(r))
            } else {
              next.resolve(onrejectedResult);
            }
          } catch (err) {
            next.reject(err);
          }
        });
      }
    } else if (!this.isRejected && onfulfilled) {
      const onfulfilledResult = onfulfilled(this.value);
      if (isPromiseLike(onfulfilledResult)) {
        onfulfilledResult.then((value) => next.resolve(value));
      } else {
        next.resolve(onfulfilledResult);
      }
    } else if (this.isRejected && onrejected) {
      const onrejectedResult = onrejected(this.reason);
      if (isPromiseLike(onrejectedResult)) {
        onrejectedResult.then((value) => next.resolve(value))
      } else {
        next.resolve(onrejectedResult);
      }
    }

    return next;
  }
}

describe('Testing fromAsync() function.', () => {

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

  describe('With promise.', () => {

    it('Should gracefully change value from undefined to not undefined when promise resolves.', () => {
      const log: string[] = [];
      const promise = new FakePromise<string>(() => log.push('A'));
      const source = fromAsync(promise);
      expect(log).toEqual(['A']);
      expect(source()).toBeUndefined();
      promise.resolve('B');
      expect(source()).toBe('B');
    });

    it('Should run onError callback when promise rejects', () => {
      const log: any[] = [];
      const promise = new FakePromise();
      const source = fromAsync(promise, (e) => log.push(e));
      const err = new Error();
      promise.reject(err)
      expect(log).toEqual([err])
    });

  });

  describe('With function returning promise.', () => {

    it('Should gracefully change value from undefined to not undefined when promise resolves.', () => {
      const log: string[] = [];
      const promise = new FakePromise<string>(() => log.push('A'));
      const source = fromAsync(() => promise);
      expect(log).toEqual([]);
      expect(source()).toBeUndefined();
      expect(log).toEqual(['A']);
      promise.resolve('B');
      expect(source()).toBe('B');
    });

    it('Should run onError callback when promise rejects', () => {
      const log: any[] = [];
      const promise = new FakePromise();
      const source = fromAsync(promise, (e) => log.push(e));
      source();
      const err = new Error();
      promise.reject(err)
      expect(log).toEqual([err])
    });

  });

  describe('With observable.', () => {
    it(
      'Should gracefully change value from undefined to not undefined when observable and it ' +
      'should change value when observable continue emitting values.',
    () => {
      Subject
      const log: string[] = [];
      const subject = new Subject<string>();
      const source = fromAsync(subject);
      subscribe(source, (value) => log.push(value), destroyRef)
      subject.next('A');
      subject.next('B');
      subject.next('C');
      expect(log).toEqual(['A', 'B', 'C']);
    });

    it('Should run onError callback when observable emits error.', () => {
      const log: any[] = [];
      const subject = new Subject<string>();
      const source = fromAsync(subject, (e) => log.push(e));
      subscribe(source, () => {}, destroyRef);
      const err = new Error();
      subject.error(err);
      expect(log).toEqual([err]);
    });
  });
});
