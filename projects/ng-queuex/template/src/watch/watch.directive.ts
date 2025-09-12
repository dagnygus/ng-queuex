import { isPlatformServer } from "@angular/common";
import { Directive, inject, OnDestroy, PLATFORM_ID, TemplateRef, ViewContainerRef, ViewRef } from "@angular/core";
import { createWatch, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, scheduleChangeDetection, detectChangesSync, onTaskExecuted, isInConcurrentTaskContext, assertNgQueuexIntegrated } from "@ng-queuex/core";

/**
 * @Directive QueuexWatch
 *
 * `QueuexWatch` is a lightweight structural directive designed for highly efficient, fine-grained property bindings on DOM elements.
 * It is particularly suited for cases where only a small number of bindings are required (e.g. one or two element properties).
 *
 * Unlike traditional bindings, `QueuexWatch` immediately creates its embedded view, detaching it from Angular’s logical
 * tree and assigning it a dedicated reactive context. This design ensures that change detection runs independently from the host
 * component or Angular’s global cycles.
 *
 * Change detection is triggered as quickly as possible, using one of the following strategies depending on the current runtime state:
 * - `onTaskExecuted(listener: VoidFunction)` hook, if a Task is currently running,
 * - otherwise, a concurrent scheduler with the highest priority.
 *
 * This makes `QueuexWatch` ideal for scenarios where reactive signals are used in detached components (`ChangeDetectorRef#detach()`),
 * and where binding directly to element properties results in a more elegant and performant solution.
 *
 * @example
 * ```html
 * <!-- Detached component with reactive signals -->
 * <span *watch textContent="personName()"></span>
 *
 * <!-- Multiple properties can be bound if needed -->
 * <input
 *   *watch
 *   [value]="personName()"
 *   [title]="personAge() + ' years old'"
 * />
 * ```
 *
 * ### Server side fallback
 *
 * On the server side, QueuexWatch is fully transparent and falls back to standard Angular property bindings, ensuring predictable SSR output without any additional overhead.
 *
 */
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
        () => this._runEffect(),
        () => this._scheduleEffect(),
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

  private _runEffect(): void {
    if (!this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      this._viewRef.detach();
    }
    detectChangesSync(this._viewRef);
    this._scheduled = false;
  }

  private _scheduleEffect(): void {
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
