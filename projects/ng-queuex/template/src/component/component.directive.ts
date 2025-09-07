import { isPlatformServer } from "@angular/common";
import { ChangeDetectorRef, Directive, inject, InjectionToken, OnDestroy, PLATFORM_ID, ValueProvider } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, assertNgQueuexIntegrated, detectChangesSync, PriorityLevel, PriorityName, priorityNameToNumber, scheduleChangeDetection } from "@ng-queuex/core";

declare const ngDevMode: boolean | undefined;

const QX_COMPONENT_PRIORITY = new InjectionToken<PriorityLevel>('QX_COMPONENT_PRIORITY', { factory: () => 3 /** Priority.Normal */ })

export function provideQueuexComponentPriority(priority: PriorityName): ValueProvider {
  return { provide: QX_COMPONENT_PRIORITY, useValue: priorityNameToNumber(priority, 'provideQueuexComponentPriority()') }
}

@Directive()
export class QueuexComponent implements OnDestroy {
  private _abortTask: AbortTaskFunction | null = null;
  private _watcher: Watch | null = null;

  constructor() {
    assertNgQueuexIntegrated('QueuexComponent: Assertion failed! "@ng-queuex/core" integration not provided.');
    const cdRef = inject(ChangeDetectorRef, { self: true, optional: true });

    if((typeof ngDevMode === 'undefined' || ngDevMode) && !cdRef) {
      throw new Error('"QueuexComponent" can be used only as a host directive for angular components! Other usage is disallowed.')
    }
    if (isPlatformServer(inject(PLATFORM_ID))) { return; }

    cdRef!.detach()
    this._watcher = createWatch(
      () => detectChangesSync(cdRef!),
      () => {
        this._abortTask = scheduleChangeDetection(() => this._watcher!.run());
      },
      true
    )
  }

  ngOnDestroy(): void {
    this._abortTask?.();
    this._watcher?.destroy();
  }
}
