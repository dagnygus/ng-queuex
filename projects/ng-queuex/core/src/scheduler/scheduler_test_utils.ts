import { Priority } from "./scheduler_utils";

export function randomPriority(): Priority {
  return Math.round(1 + 4 * Math.random())
}

export function randomPrioritiesArray(minLen: number = 80, maxLen: number = 150): Priority[] {
  if (minLen > maxLen) {
    throw new Error('randomPrioritiesArray: MinLen > maxLen');
  }

  if (minLen < 1) {
    throw new Error('randomPrioritiesArray(minLen, maxLen): MinLen < 0');
  }

  const length = minLen + Math.round((maxLen - minLen) * Math.random())
  const priorities: Priority[] = new Array(length);

  for (let i = 0; i < length; i++) {
    priorities[i] = randomPriority();
  }

  return priorities
}

export function describeWithoutZone(cb: () => void) {
  describe('Without zone.', cb);
}

export function describeFakeAsync(cb: () => void) {
  describe('In fakeAsync zone.', cb);
}

export function describeAsyncAwait(cb: () => void) {
  describe('Using async/await', cb);
}

export function doSomethingForSomeTime() {
  const maxMillis = Math.round(0.5 + 0.5 * Math.random());
  const startTime = performance.now();
  while(performance.now() - startTime < maxMillis) {}
}

export function doSomethingForTime(millis: number) {
  if (millis < 0) {
    throw new Error('doSomethingForTime(millis): millis < 0')
  }

  const startTime = performance.now();
  while(performance.now() - startTime < millis) {}
}

export function getRandomPositiveInteger(min: number, max: number) {
  if (min > max) { throw new Error('getRandomPositiveInteger(min, max): min > max'); }
  if (min < 0) { throw new Error('getRandomPositiveInteger(min, max): min < 0'); }

  return Math.round(min + (max - min) * Math.random());
}
