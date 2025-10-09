import { Injector, PendingTasks, runInInjectionContext } from "@angular/core";
import { Schedulers } from "./schedulers";

class FakePendingTask {
  constructor(private readonly _log: string[]) {}

  add(): VoidFunction {
    this._log.push('A');
    return () => {
      this._log.push('B')
    }
  }
}

describe('Scheduler service.', () => {

  describe('Testing setTimeout() method', () => {

    it('Should register pending task if delay is undefined.', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        schedulers.setTimeout(() => queueMicrotask(() => {
          expect(log).toEqual([ 'A', 'B' ]);
          done();
        }))
      });
    });

    it('Should register pending task if delay is 0.', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        schedulers.setTimeout(() => queueMicrotask(() => {
          expect(log).toEqual([ 'A', 'B' ]);
          done();
        }), 0)
      });
    });

    it('Should register pending task if delay is less then 0.', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        schedulers.setTimeout(() => queueMicrotask(() => {
          expect(log).toEqual([ 'A', 'B' ]);
          done();
        }), -1);
      });
    });

    it('Should register pending task is delay is bigger then 0 but not greater or equal 1.', (done) => {
       const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        schedulers.setTimeout(() => queueMicrotask(() => {
          expect(log).toEqual([ 'A', 'B' ]);
          done();
        }), 0.9999999);
      });
    });

    it('Should not register pending task is delay is much bigger then 0.', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        schedulers.setTimeout(() => queueMicrotask(() => {
          expect(log).toEqual([]);
          done();
        }), 1);
      });
    });

    it('Clearing timeout function should unregister pending task', () => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearTimeout = schedulers.setTimeout(() => {});
        clearTimeout();
        expect(log).toEqual([ 'A', 'B' ]);
      })
    })

  });

  describe('Testing setInterval method', () => {

    it('Should register pending task if timeout is undefined', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearInterval = schedulers.setInterval(() => {
          clearInterval();
          expect(['A']);
          queueMicrotask(() => {
            expect(log).toEqual([ 'A', 'B' ]);
            done();
          });
        })
      })
    });

    it('Should register pending task if timeout is 0', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearInterval = schedulers.setInterval(() => {
          clearInterval();
          expect(['A']);
          queueMicrotask(() => {
            expect(log).toEqual([ 'A', 'B' ]);
            done();
          });
        }, 0);
      });
    });

    it('Should register pending task if timeout is bigger then 0 but no greater or equal 1.', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearInterval = schedulers.setInterval(() => {
          clearInterval();
          expect(['A']);
          queueMicrotask(() => {
            expect(log).toEqual([ 'A', 'B' ]);
            done();
          });
        }, 0.999999);
      });
    });

    it('Should not register pending task if timeout is much bigger then 0', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearInterval = schedulers.setInterval(() => {
          clearInterval();
          queueMicrotask(() => {
            expect(log).toEqual([]);
            done();
          });
        }, 1);
      });
    });

    it('Should unregister pending task when interval is cleared early.', () => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers();
        const clearInterval = schedulers.setInterval(() => {});
        clearInterval();
        expect(log).toEqual([ 'A', 'B' ]);
      });
    });
  });

  describe('Testing scheduleMicrotask method', () => {

    it('Should register pending task', (done) => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers()
        schedulers.scheduleMicrotask(() => queueMicrotask(() => {
          expect(log).toEqual(['A', 'B']);
          done()
        }));
      });
    });

    it('Should unregister pending task if microtask gets canceled', () => {
      const log: string[] = [];
      const injector = Injector.create({ providers: [{ provide: PendingTasks, useValue: new FakePendingTask(log) }] });
      runInInjectionContext(injector, () => {
        const schedulers = new Schedulers()
        const cancelMicrotask = schedulers.scheduleMicrotask(() => {});
        cancelMicrotask();
        expect(log).toEqual(['A', 'B']);
      });
    })
  })
});
