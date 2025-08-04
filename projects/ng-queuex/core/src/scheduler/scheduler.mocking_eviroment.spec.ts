// import { ɵglobal } from '@angular/core';

// interface Runtime {
//   advanceTime(ms: number): void;
//   fireMessageEvent(): void;
//   log(value: string): void;
//   isLogEmpty(): boolean;
//   assertLog(expected: string[]): void
// }

// const originalPerformance = ɵglobal.performance;
// const originalSetTimeout = ɵglobal.setTimeout;
// const originalClearTimeout = ɵglobal.clearTimeout;
// const originalSetImmediate = ɵglobal.setImmediate;
// const originalClearImmediate = ɵglobal.clearImmediate;
// const originalRequestAnimationFrame = ɵglobal.requestAnimationFrame;
// const originalCancelAnimationFrame = ɵglobal.cancelAnimationFrame;
// const originalMessageChannel = ɵglobal.MessageChannel;

// const runtimes = ['Browser.', 'Node.', 'NonBrowser.'];

// export enum Priority {
//   Highest = 1,
//   High = 2,
//   Normal = 3,
//   Low = 4,
//   Lowest = 5
// }

// const Priorities = [Priority.Lowest, Priority.Low, Priority.Normal, Priority.High, Priority.Highest];

// const enum LogEvent {
//     Task = 'Task',
//     SetTimer = 'Set Timer',
//     SetImmediate = 'Set Immediate',
//     PostMessage = 'Post Message',
//     MessageEvent = 'Message Event',
//     Continuation = 'Continuation',
// }

// function installMockBrowserRuntime(): Runtime {
//   let timerIdCounter = 0;
//   let currentTime = 0;
//   let eventLogs: string[] = [];
//   let hasPendingMessageEvent = false;

//   ɵglobal.performance.now = () => {
//     return currentTime;
//   };

//   ɵglobal.requestAnimationFrame = ɵglobal.cancelAnimationFrame = () => {};

//   ɵglobal.setTimeout = () => {
//     const id = timerIdCounter++;
//     log(LogEvent.SetTimer);
//     return id;
//   };

//   ɵglobal.clearTimeout = () => {};

//   const port1 = {} as MessagePort;
//   const port2 = {
//     postMessage() {
//       if (hasPendingMessageEvent) {
//         throw Error('Message event already scheduled');
//       }
//       log(LogEvent.PostMessage);
//       hasPendingMessageEvent = true;
//     },
//   };

//   ɵglobal.MessageChannel = function MessageChannel() {
//     this.port1 = port1;
//     this.port2 = port2;
//   };

//   ɵglobal.setImmediate = undefined;

//   function ensureLogIsEmpty(): void | never {
//     if (eventLogs.length !== 0) {
//       throw Error('Log is not empty. Call assertLog before continuing.');
//     }
//   }

//   function advanceTime(ms: number): void {
//     currentTime += ms;
//   }

//   function fireMessageEvent(): void {
//     ensureLogIsEmpty();
//     if (!hasPendingMessageEvent) {
//       throw Error('No message event was scheduled');
//     }
//     hasPendingMessageEvent = false;
//     const onMessage = port1.onmessage as any;
//     log(LogEvent.MessageEvent);
//     onMessage.call(port1);
//   }

//   function log(value: string): void {
//     eventLogs.push(value);
//   }

//   function isLogEmpty(): boolean {
//     return eventLogs.length === 0;
//   }

//   function assertLog(expected: string[]): void {
//     const actual = eventLogs;
//     eventLogs = [];
//     expect(actual).toEqual(expected);
//   }

//   return {
//     advanceTime,
//     fireMessageEvent,
//     log,
//     isLogEmpty,
//     assertLog,
//   };
// }

// function installMockNodeRuntime(): Runtime {
//   const _runtime = installMockBrowserRuntime();
//   let immediateIdCounter = 0;
//   let pendingExhaust: (() => void) | null = null;

//   ɵglobal.setImmediate = (cb: () => void) => {
//     if (pendingExhaust) {
//       throw Error('Message event already scheduled');
//     }
//     const id = immediateIdCounter++;
//     _runtime.log(LogEvent.SetImmediate);
//     pendingExhaust = cb;
//     return id;
//   };

//   ɵglobal.clearImmediate = () => {};

//   function fireMessageEvent(): void {
//     if (!pendingExhaust) {
//       throw Error('No message event was scheduled');
//     }
//     _runtime.log(LogEvent.MessageEvent);
//     const exhaust = pendingExhaust;
//     pendingExhaust = null;
//     exhaust();
//   }
//   return {
//     advanceTime: _runtime.advanceTime,
//     fireMessageEvent,
//     log: _runtime.log,
//     isLogEmpty: _runtime.isLogEmpty,
//     assertLog: _runtime.assertLog,
//   };
// }

// function installMockNonBrowserRuntime(): Runtime {
//   const _runtime = installMockBrowserRuntime();
//     let immediateIdCounter = 0;
//     let pendingExhaust: (() => void) | null = null;
//     ɵglobal.MessageChannel = undefined;
//     ɵglobal.setTimeout = (cb: () => void) => {
//       const id = immediateIdCounter++;
//       _runtime.log(LogEvent.SetTimer);
//       pendingExhaust = cb;
//       return id;
//     };
//     // eslint-disable-next-line @typescript-eslint/no-empty-function
//     ɵglobal.clearTimeout = () => {};

//     function fireMessageEvent(): void {
//       if (!pendingExhaust) {
//         throw Error('No message event was scheduled');
//       }
//       _runtime.log(LogEvent.MessageEvent);
//       const exhaust = pendingExhaust;
//       pendingExhaust = null;
//       exhaust();
//     }
//     return {
//       advanceTime: _runtime.advanceTime,
//       fireMessageEvent,
//       log: _runtime.log,
//       isLogEmpty: _runtime.isLogEmpty,
//       assertLog: _runtime.assertLog,
//     };
// }

// describe('Scheduler. Mocking Environment.', () => {
//   let runtime: Runtime;
//   let performance: Performance;
//   let schedulingMessageEvent: LogEvent

//   runtimes.forEach((env) => {
//     describe(env, () => {

//       beforeEach(() => {
//         if (typeof require.cache[require.resolve('./scheduler')] !== undefined) {
//           delete require.cache[require.resolve('./scheduler')];
//         }

//         switch (env) {
//           case 'Browser.':
//             runtime = installMockBrowserRuntime();
//             schedulingMessageEvent = LogEvent.PostMessage;
//             break;
//           case 'Node.':
//             runtime = installMockNodeRuntime();
//             schedulingMessageEvent = LogEvent.SetImmediate
//             break;
//           case 'NonBrowser.':
//           default:
//             runtime = installMockNonBrowserRuntime();
//             schedulingMessageEvent = LogEvent.SetTimer;
//             break;
//         }
//       })
//     })

//   })

// })
