import { ChangeDetectionStrategy, Component, forwardRef, input, isSignal, provideZonelessChangeDetection, Signal, signal } from "@angular/core";
import { advancePriorityInputTransform, coercePriority, noopFn, Priority, priorityInputTransform, PriorityLevel, priorityNameToNumber } from "./scheduler_utils"
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

describe('Testing coercePriority() function', () => {
  it('Should round input and clamp between 1 and 5', () => {
    expect(coercePriority(-100)).toBe(1);
    expect(coercePriority(-5)).toBe(1);
    expect(coercePriority(-1)).toBe(1);
    expect(coercePriority(0)).toBe(1);
    expect(coercePriority(0.4999999)).toBe(1);
    expect(coercePriority(0.5)).toBe(1);
    expect(coercePriority(1)).toBe(1);
    expect(coercePriority(1.4999999)).toBe(1);
    expect(coercePriority(1.5)).toBe(2);
    expect(coercePriority(2.4999999)).toBe(2);
    expect(coercePriority(2.5)).toBe(3);
    expect(coercePriority(3.4999999)).toBe(3);
    expect(coercePriority(3.5)).toBe(4);
    expect(coercePriority(4.4999999)).toBe(4);
    expect(coercePriority(4.5)).toBe(5);
    expect(coercePriority(5)).toBe(5);
    expect(coercePriority(5.4999999)).toBe(5);
    expect(coercePriority(5.5)).toBe(5);
    expect(coercePriority(6)).toBe(5);
    expect(coercePriority(7)).toBe(5);
    expect(coercePriority(100)).toBe(5);
  });
})

describe('Testing priorityKeyToNumber() function.', () => {
  it('Should return numeric priority level corresponded to its name.', () => {
    expect(priorityNameToNumber('highest')).toBe(Priority.Highest);
    expect(priorityNameToNumber('high')).toBe(Priority.High);
    expect(priorityNameToNumber('normal')).toBe(Priority.Normal);
    expect(priorityNameToNumber('low')).toBe(Priority.Low);
    expect(priorityNameToNumber('lowest')).toBe(Priority.Lowest);
  });

  it('Should throw error if invalid name is provided.', () => {
    expect(() => priorityNameToNumber('superDuperF__kingBig' as any))
    .toThrowError('priorityNameToNumber(): Provided key \'superDuperF__kingBig\' is not recognized as priority!')
  });
});

describe('Testing priorityInputTransform() function', () => {
  it('Should return numeric priority level corresponded to its name.', () => {
    expect(priorityInputTransform('highest')).toBe(Priority.Highest);
    expect(priorityInputTransform('high')).toBe(Priority.High);
    expect(priorityInputTransform('normal')).toBe(Priority.Normal);
    expect(priorityInputTransform('low')).toBe(Priority.Low);
    expect(priorityInputTransform('lowest')).toBe(Priority.Lowest);
  });

  it('Should return provided numeric arg.', () => {
    expect(priorityInputTransform(1)).toBe(1);
    expect(priorityInputTransform(2)).toBe(2);
    expect(priorityInputTransform(3)).toBe(3);
    expect(priorityInputTransform(4)).toBe(4);
    expect(priorityInputTransform(5)).toBe(5);
  });

  it('Should round numeric input and clamp between 1 and 5 and transform names to numbers.', () => {
    expect(priorityInputTransform(-100 as any)).toBe(1);
    expect(priorityInputTransform(-5 as any)).toBe(1);
    expect(priorityInputTransform(-1 as any)).toBe(1);
    expect(priorityInputTransform(0 as any)).toBe(1);
    expect(priorityInputTransform(0.4999999 as any)).toBe(1);
    expect(priorityInputTransform(0.5 as any)).toBe(1);
    expect(priorityInputTransform(1)).toBe(1);
    expect(priorityInputTransform(1.4999999 as any)).toBe(1);
    expect(priorityInputTransform(1.5 as any)).toBe(2);
    expect(priorityInputTransform(2.4999999 as any)).toBe(2);
    expect(priorityInputTransform(2.5 as any)).toBe(3);
    expect(priorityInputTransform(3.4999999 as any)).toBe(3);
    expect(priorityInputTransform(3.5 as any)).toBe(4);
    expect(priorityInputTransform(4.4999999 as any)).toBe(4);
    expect(priorityInputTransform(4.5 as any)).toBe(5);
    expect(priorityInputTransform(5)).toBe(5);
    expect(priorityInputTransform(5.4999999 as any)).toBe(5);
    expect(priorityInputTransform(5.5 as any)).toBe(5);
    expect(priorityInputTransform(6 as any)).toBe(5);
    expect(priorityInputTransform(7 as any)).toBe(5);
    expect(priorityInputTransform(100 as any)).toBe(5);

    expect(priorityInputTransform('highest')).toBe(1);
    expect(priorityInputTransform('high')).toBe(2);
    expect(priorityInputTransform('normal')).toBe(3);
    expect(priorityInputTransform('low')).toBe(4);
    expect(priorityInputTransform('lowest')).toBe(5);
  });

  it('Should throw error if invalid name is provided.', () => {
    expect(() => priorityInputTransform('superDuperF__kingBig' as any))
    .toThrowError('priorityInputTransform(): Provided key \'superDuperF__kingBig\' is not recognized as priority!')
  });
});

describe('Testing advancePriorityInputTransform() function', () => {
  it('Should round numeric input and clamp between 1 and 5 and transform names to numbers.', () => {
    expect(advancePriorityInputTransform(-100 as any)).toBe(1);
    expect(advancePriorityInputTransform(-5 as any)).toBe(1);
    expect(advancePriorityInputTransform(-1 as any)).toBe(1);
    expect(advancePriorityInputTransform(0 as any)).toBe(1);
    expect(advancePriorityInputTransform(0.4999999 as any)).toBe(1);
    expect(advancePriorityInputTransform(0.5 as any)).toBe(1);
    expect(advancePriorityInputTransform(1)).toBe(1);
    expect(advancePriorityInputTransform(1.4999999 as any)).toBe(1);
    expect(advancePriorityInputTransform(1.5 as any)).toBe(2);
    expect(advancePriorityInputTransform(2.4999999 as any)).toBe(2);
    expect(advancePriorityInputTransform(2.5 as any)).toBe(3);
    expect(advancePriorityInputTransform(3.4999999 as any)).toBe(3);
    expect(advancePriorityInputTransform(3.5 as any)).toBe(4);
    expect(advancePriorityInputTransform(4.4999999 as any)).toBe(4);
    expect(advancePriorityInputTransform(4.5 as any)).toBe(5);
    expect(advancePriorityInputTransform(5)).toBe(5);
    expect(advancePriorityInputTransform(5.4999999 as any)).toBe(5);
    expect(advancePriorityInputTransform(5.5 as any)).toBe(5);
    expect(advancePriorityInputTransform(6 as any)).toBe(5);
    expect(advancePriorityInputTransform(7 as any)).toBe(5);
    expect(advancePriorityInputTransform(100 as any)).toBe(5);

    expect(advancePriorityInputTransform('highest')).toBe(1);
    expect(advancePriorityInputTransform('high')).toBe(2);
    expect(advancePriorityInputTransform('normal')).toBe(3);
    expect(advancePriorityInputTransform('low')).toBe(4);
    expect(advancePriorityInputTransform('lowest')).toBe(5);
  });

  it('Should throw error if invalid name is provided.', () => {
    expect(() => advancePriorityInputTransform('superDuperF__kingBig' as any))
    .toThrowError('priorityInputTransform(): Provided key \'superDuperF__kingBig\' is not recognized as priority!')
  });

  it('Should transform signal to computed signal witch will provide priority levels as rounded numbers clamped between 1 and 5.', () => {
    const source = signal<number | string>(0);
    const derived = advancePriorityInputTransform(source as any) as unknown as Signal<PriorityLevel>;

    expect(isSignal(derived)).toBeTrue();
    expect(derived()).toBe(1);
    source.set(-100);
    expect(derived()).toBe(1);
    source.set(1);
    expect(derived()).toBe(1);
    source.set(1.49999999);
    expect(derived()).toBe(1);
    source.set(1.5);
    expect(derived()).toBe(2);
    source.set(2);
    expect(derived()).toBe(2);
    source.set(2.4999999);
    expect(derived()).toBe(2);
    source.set(2.5);
    expect(derived()).toBe(3);
    source.set(3);
    expect(derived()).toBe(3);
    source.set(2.5);
    expect(derived()).toBe(3);
    source.set(3);
    expect(derived()).toBe(3);
    source.set(3.4999999);
    expect(derived()).toBe(3);
    source.set(3.5);
    expect(derived()).toBe(4);
    source.set(4);
    expect(derived()).toBe(4);
    source.set(4.4999999);
    expect(derived()).toBe(4);
    source.set(4.5);
    expect(derived()).toBe(5);
    source.set(5);
    expect(derived()).toBe(5);
    source.set(10);
    expect(derived()).toBe(5);

    source.set('highest');
    expect(derived()).toBe(1);
    source.set('high')
    expect(derived()).toBe(2);
    source.set('normal');
    expect(derived()).toBe(3);
    source.set('low')
    expect(derived()).toBe(4);
    source.set('lowest');
    expect(derived()).toBe(5);
  });

  it('Computed signal should throw error when underlying value is invalid.', () => {
    const source = signal('superDuperF__kingBig');
    const derived = advancePriorityInputTransform(source as any) as unknown as Signal<any>;
    expect(() => derived()).toThrowError('advancePriorityInputTransform(): Provided key \'superDuperF__kingBig\' is not recognized as priority!')
  })
})
