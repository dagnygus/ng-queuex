import { isPlatformServer } from "@angular/common";
import { AfterContentChecked, Directive, inject, InjectionToken, input, OnDestroy, PLATFORM_ID, TemplateRef, ValueProvider, ViewContainerRef, ViewRef } from "@angular/core";
import { createWatch, SIGNAL, SignalNode, Watch } from "@angular/core/primitives/signals";
import { AbortTaskFunction, PriorityLevel, scheduleChangeDetection, detectChangesSync, PriorityName, priorityNameToNumber } from "@ng-queuex/core";

const QX_WATCH_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_WATCH_DEFAULT_PRIORITY', { factory: () => 1 /* Highest */ });

export function provideQueuexWatchDefaultPriority(priorityName: PriorityName): ValueProvider {
  return { provide: QX_WATCH_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priorityName, ' provideQueuexWatchDefaultPriority()') }
}

@Directive({ selector: '[watch]', standalone: true })
export class QueuexWatch implements OnDestroy, AfterContentChecked {
  private _init = false;
  private _viewRef: ViewRef | null = null;
  private _watch: Watch | null = null;
  private _abortTask: AbortTaskFunction | null = null;
  private _vcRef = inject(ViewContainerRef);
  private _tmpRef = inject(TemplateRef);
  private _priorityNode: SignalNode<PriorityLevel> | null = null;

  priority = input(inject(QX_WATCH_DEFAULT_PRIORITY));

  constructor() {
    if (isPlatformServer(PLATFORM_ID)) {
      this._vcRef.createEmbeddedView(this._tmpRef);
    } else {
      this._priorityNode = this.priority[SIGNAL];
      this._watch = createWatch(
        () => this._effectCallback(),
        () => this._scheduleEffectCallback(),
        false
      );
      this._watch.notify();
      this._watch.run();
    }
  }

  ngAfterContentChecked(): void {
    if (this._init) { return; }
    this._init = true;
    if (this._viewRef) {
      detectChangesSync(this._viewRef);
    }
  }

  ngOnDestroy(): void {
    this._abortTask?.();
    this._watch?.destroy();
  }

  private _effectCallback(): void {
    if (!this._viewRef) {
      this._viewRef = this._vcRef.createEmbeddedView(this._tmpRef);
      this._viewRef.detach();
    }
    if (this._init) {
      detectChangesSync(this._viewRef);
    }
  }

  private _scheduleEffectCallback(): void {
    if (this._viewRef) {
      this._abortTask = scheduleChangeDetection(
        () => this._watch!.run(),
        this._priorityNode!.value,
        this._viewRef
      )
    }
  }


}
