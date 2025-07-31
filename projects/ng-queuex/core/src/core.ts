import {
  APP_BOOTSTRAP_LISTENER,
  ApplicationRef,
  EnvironmentProviders,
  inject,
  Injectable,
  Injector,
  makeEnvironmentProviders,
  PendingTasks,
  provideEnvironmentInitializer
} from "@angular/core";
import { isTaskQueueEmpty, setOnIdle } from "./scheduler/scheduler";

export * from "./instructions/instructions";
export {
  assertConcurrentTaskContext,
  assertConcurrentCleanTaskContext,
  assertConcurrentDirtyTaskContext,
  isConcurrentTaskContext,
  isConcurrentCleanTaskContext,
  isConcurrentDirtyTaskContext,
  onTaskExecuted,
} from "./scheduler/scheduler";

@Injectable({ providedIn: 'root' })
class ZonelessIntegrator {
  private _appRef = inject(ApplicationRef);
  private _pendingTasks = inject(PendingTasks);
  private _pendingNgTaskCleanup: (() => void) = null!;
  private _bootstrapCount = 0;

  public validateEnvironment(injector: Injector): boolean {
    return this._appRef.injector === injector;
  }

  public initialize(): void {
    this._pendingNgTaskCleanup = this._pendingTasks.add();
    setOnIdle(() => this._pendingNgTaskCleanup())
    const subscription = this._appRef.isStable.subscribe((value) => {
      if (value) {
        setOnIdle(null);
        subscription.unsubscribe();
      }
    });
  }

  public onBootstrap(): void {
    if (++this._bootstrapCount >= this._appRef.components.length && isTaskQueueEmpty()) {
      // During bootstrap there was not scheduled any concurrent task.
      // That means that internal onIdle hook will not be invoke, so we need to cleanup
      // angular pending task manually. That will stabilize application and do rest of the cleanup.
      this._pendingNgTaskCleanup();
    }
  }
}

export function provideIntegrationWithZonelessChangeDetection(): EnvironmentProviders {
  return makeEnvironmentProviders([

    provideEnvironmentInitializer(() => {
      const integrator = inject(ZonelessIntegrator);
      if (!integrator.validateEnvironment(inject(Injector))) {
        throw new Error('provideIntegrationWithZonelessChangeDetection(): It needs to be provided at top root level of the application! You can not provide integration in lazy loaded modules!')
      }
      integrator.initialize();
    }),

    {
      provide: APP_BOOTSTRAP_LISTENER,
      multi: true,
      useFactory: () => {
        const integrator = inject(ZonelessIntegrator);
        return () => {
          integrator.onBootstrap();
        }
      }
    }

  ])
}
