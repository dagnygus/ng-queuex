import { computed, isSignal, Signal } from "@angular/core";

export interface SchedulerTask {
  id: number;
  sortIndex: number;
  callback: VoidFunction | null;
  priorityLevel: Priority;
  startTime: number;
  expirationTime: number;
  zone: ZoneMinApi;
  status: TaskStatus;
  scopeToHandle: object | null;
  abort: VoidFunction;
  beforeExecute: VoidFunction;
  // cleanup: VoidFunction;
  isClean: boolean;
  onExecutedListeners: VoidFunction[] | null;
  internalOnExecutedListeners: VoidFunction[] | null;
  onAbort: VoidFunction;
  // cleanup: VoidFunction;
}

export interface ZoneMinApi {
  run<T>(callback: Function, applyThis?: any, applyArgs?: any[], source?: string): T;
}

export interface Zone extends ZoneMinApi {
  scheduleMacroTask(
    source: string,
    callback: Function,
    data?: any,
    customSchedule?: (task: ZoneTask) => void,
    customCancel?: (task: ZoneTask) => void,
  ): ZoneTask;
}

export interface ZoneTask {
  invoke: Function;
}

export interface ZoneType {
  current: Zone;
  root: Zone;
  __symbol__(name: string): string;
}

export const enum TaskStatus {
  Pending = 0,
  Prepared = 1, //For execution;
  Executing = 2,
  Executed = 3,
  Aborted = 4
}

/**
 * A string representation of priority.
 */
export type PriorityName = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

/**
 * A numeric representation of priority.
 */
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Component input type of priority, representing priority numeric value or priority name.
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 */
export type PriorityInput = PriorityLevel | PriorityName;

/**
 *  Concurrent task priority.
 *  ```
 *    Highest = 1
 *    High = 2
 *    Normal = 3 (Mostly a default one)
 *    Low = 4
 *    Lowest = 5
 *  ```
 */
export enum Priority {
  Highest = 1,
  High = 2,
  Normal = 3,
  Low = 4,
  Lowest = 5
}


export function push(heap: SchedulerTask[], node: SchedulerTask): void {
  const index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}

export function peek(heap: SchedulerTask[]): SchedulerTask | null {
  const first = heap[0];
  return first === undefined ? null : first;
}

export function pop(heap: SchedulerTask[]): SchedulerTask | null {
  const first = heap[0];
  if (first !== undefined) {
    const last = heap.pop()!;
    if (last !== first) {
      heap[0] = last;
      siftDown(heap, last, 0);
    }
    return first;
  } else {
    return null;
  }
}

function siftUp(heap: SchedulerTask[], node: SchedulerTask, i: number) {
  let index = i;
  while (true) {
    const parentIndex = (index - 1) >>> 1;
    const parent = heap[parentIndex];
    if (parent !== undefined && compare(parent, node) > 0) {
      // The parent is larger. Swap positions.
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    } else {
      // The parent is smaller. Exit.
      return;
    }
  }
}

function siftDown(heap: SchedulerTask[], node: SchedulerTask, i: number) {
  let index = i;
  const length = heap.length;
  while (index < length) {
    const leftIndex = (index + 1) * 2 - 1;
    const left = heap[leftIndex];
    const rightIndex = leftIndex + 1;
    const right = heap[rightIndex];

    if (left !== undefined && compare(left, node) < 0) {
      if (right !== undefined && compare(right, left) < 0) {
        heap[index] = right;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (right !== undefined && compare(right, node) < 0) {
      heap[index] = right;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      // Neither child is smaller. Exit.
      return;
    }
  }
}

function compare(a: SchedulerTask, b: SchedulerTask) {
  // Compare sort index first, then task id.
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}


export function coercePriority(priority: number): Priority {
  return Math.round(Math.max(1, Math.min(5, priority)));
}

/**
 * @description
 * Converts Priority name to corresponding numeric value ('highest' => 1, 'high' => 2, 'normal' => 3, 'low' => 4, 'lowest' => 5).
 * @param priorityName A name of priority ('highest', 'high', 'normal', 'low', 'lowest').
 * @returns Numeric value of priority (1, 2, 3, 4, 5).
 */
export function priorityNameToNumber(priorityName: PriorityName): PriorityLevel;
/**
 * @description
 * Converts Priority name to corresponding numeric value ('highest' => 1, 'high' => 2, 'normal' => 3, 'low' => 4, 'lowest' => 5).
 * @param priorityName A name of priority ('highest', 'high', 'normal', 'low', 'lowest').
 * @param debugFn a reference to the function making the assertion (used for the error message).
 * @returns Numeric value of priority (1, 2, 3, 4, 5).
 */
export function priorityNameToNumber(priorityName: PriorityName, debugFn: Function): PriorityLevel;
export function priorityNameToNumber(priorityName: PriorityName, debugFn: Function = priorityNameToNumber): PriorityLevel {
  switch (priorityName) {
    case 'highest':
      return Priority.Highest;
    case 'high':
      return Priority.High;
    case 'normal':
      return Priority.Normal;
    case 'low':
      return Priority.Low;
    case 'lowest':
      return Priority.Lowest;
    default:
      throw new Error(`${debugFn.name}(): Provided key '${priorityName}' is not recognized as priority!`);
  }
}

/**
 * @description
 * Transforms priority names to it's raw numeric value.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5).
 * @returns Priority numeric level.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 */
export function priorityInputTransform(value: PriorityInput): PriorityLevel {
  if (typeof value === 'number') {
    return coercePriority(value);
  } else {
    return priorityNameToNumber(value, priorityInputTransform);
  }
}

/**
 * @description
 * Transforms priority names to it's raw numeric values or transforms signal to computed signal with the same manner.
 * @param value Priority name ('highest', 'high', 'normal', 'low', 'lowest') or priority numeric level (1, 2, 3, 4, 5) or signal providing the same values.
 * @see {@link PriorityInput}
 * @see {@link PriorityName}
 * @see {@link PriorityLevel}
 * @see {@link priorityInputTransform}
 */
export function advancePriorityInputTransform(value: PriorityInput | Signal<PriorityInput>): PriorityLevel | Signal<PriorityLevel> {
  if (isSignal(value)) {
    return computed(() => {
      const v =  value();
      if (typeof v === 'number') {
      return coercePriority(v);
    } else {
      return priorityNameToNumber(v, advancePriorityInputTransform);
  }
    })
  } else {
    if (typeof value === 'number') {
      return coercePriority(value);
    } else {
      return priorityNameToNumber(value, advancePriorityInputTransform);
    }
  }
}

export const noopFn: VoidFunction = function() {}
