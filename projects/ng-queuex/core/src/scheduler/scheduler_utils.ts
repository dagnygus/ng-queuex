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
}

export const enum TaskStatus {
  Pending = 0,
  Prepared = 1, //For execution;
  Executing = 2,
  Executed = 3,
  Aborted = 4
}

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

export const noopFn: VoidFunction = function() {}

// export function taskCleanup(this: SchedulerTask): void {
//   this.scopeToHandle = null;
// }
