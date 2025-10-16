import { TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import { CleanupScope, createTestCleanupScope } from '../../cleanup_scope/cleanup_scope';
import { map } from './map';

describe('Testing map function', () => {

  it('Should throw error when it us used outside cleanup scope.', () => {
    const inputSource = signal(undefined);
    expect(() => map<undefined, undefined>(() => undefined)(inputSource)).toThrowError(
      'map(): Current stack frame is not within cleanup scope.'
    )
  });

  it('Should project output signal correctly', () => {
    const log: string[] = []
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, string>((value) => String(2 * value))(inputSource));

    log.push(outputSource());
    inputSource.set(1);
    log.push(outputSource());
    inputSource.set(2);
    log.push(outputSource());
    inputSource.set(3);
    log.push(outputSource());

    expect(log).toEqual([ '0', '2', '4', '6' ]);
  });

  it('Should run project() function in child cleanup scope.', () => {
    const log: string[] = []
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, number>((value) => {
      expect(scope.children().length).toBe(1)
      expect(CleanupScope.current()).toBe(scope.children()[0] as any)
      log.push('A')
      return value
    })(inputSource));

    outputSource();
    expect(log).toEqual([ 'A' ]);
  });

  it('Should run cleanup logic on every new project function call.', () => {
    const log: string[] = []
    const scope = createTestCleanupScope({ injector: TestBed.inject(Injector) });
    const inputSource = signal(0);
    const outputSource = scope.run(() => map<number, number>((value) => {
      CleanupScope.assertCurrent().add(() => log.push('A'))
      return value
    })(inputSource));

    outputSource();
    expect(log).toEqual([]);

    inputSource.set(1);
    outputSource();
    expect(log).toEqual([ 'A' ]);

    inputSource.set(2);
    outputSource();
    expect(log).toEqual([ 'A', 'A' ]);
  });
});
