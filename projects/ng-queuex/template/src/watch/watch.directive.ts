import { isPlatformServer } from "@angular/common";
import { Directive, inject, OnDestroy, PLATFORM_ID, TemplateRef, ViewContainerRef, ViewRef } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, scheduleChangeDetection, detectChangesSync, onTaskExecuted, isInConcurrentTaskContext, assertNgQueuexIntegrated } from "@ng-queuex/core";

@Directive({ selector: 'ng-template[watch]', standalone: true })
export class QueuexWatch implements OnDestroy {
  private _viewRef: ViewRef | null = null;
  private _watcher: Watch | null = null;
  private _abortTask: AbortTaskFunction | null = null;
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _destroyed = false;
  private _scheduled = false;

  constructor() {
    assertNgQueuexIntegrated('[watch]: Assertion failed! "@ng-queuex/core" not provided.');
    if (isPlatformServer(inject(PLATFORM_ID))) {
      this._vcRef.createEmbeddedView(this._tmpRef);
    } else {
      this._watcher = createWatch(
        () => this._effectCallback(),
        () => this._scheduleEffectCallback(),
        false
      );
      this._watcher.notify();
      this._watcher.run();
    }
  }


  ngOnDestroy(): void {
    this._destroyed = true;
    this._abortTask?.();
    this._watcher?.destroy();
  }

  private _effectCallback(): void {
    if (!this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      this._viewRef.detach();
    }
    detectChangesSync(this._viewRef);
    this._scheduled = false;
  }

  private _scheduleEffectCallback(): void {
    if (this._scheduled) { return; }
    this._scheduled = true;

    if (this._viewRef) {
      if (isInConcurrentTaskContext()) {
        if (this._destroyed) { return; }
        onTaskExecuted(() => this._watcher!.run())
      } else {
        this._abortTask = scheduleChangeDetection(
          () => this._watcher!.run(),
          1,
          this._viewRef
        );
      }

    }
  }


}
