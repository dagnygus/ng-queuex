import { ChangeDetectionStrategy, Component, forwardRef, input, provideZonelessChangeDetection, signal } from "@angular/core";
import { coercePriority, noopFn, Priority, priorityInputTransform, priorityNameToNumber } from "./scheduler_utils"
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
    .toThrowError('priorityKeyToNumber(): Provided key \'superDuperF__kingBig\' is not recognized as priority!')
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

  it('Should round numeric input and clamp between 1 and 5', () => {
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
