import { isPlatformBrowser } from "@angular/common";
import {
  Directive,
  effect,
  EmbeddedViewRef,
  inject,
  InjectionToken,
  Input,
  input,
  InputSignal,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  Signal,
  SimpleChanges,
  TemplateRef,
  ValueProvider,
  ViewContainerRef,
} from "@angular/core";
import { REACTIVE_NODE, ReactiveNode, setActiveConsumer, Watch } from "@angular/core/primitives/signals";
import {
  PriorityLevel,
  Priority,
  assertNgQueuexIntegrated,
  PriorityName,
  priorityNameToNumber,
  priorityInputTransform,
  scheduleChangeDetection
} from "@ng-queuex/core";

interface QxIfView {
  dispose(): void
}

// interface QueuexIfEffectNode<T = unknown> extends ReactiveNode {
//   hasRun: boolean;
//   view: ClientQxIfView
//   run(): void;
//   schedule(value: T, thenTmpRef: TemplateRef<T>): void;
//   destroy(): void;
//   notify(): void;
// }

// const THEN_QUEUEX_EFFECT_NODE: Omit<QueuexIfEffectNode, 'schedule' | 'view'> =
//   /* @__PURE__ */ (() => ({
//     ...REACTIVE_NODE,
//     // consumerIsAlwaysLive: true,
//     consumerAllowSignalWrites: false,
//     dirty: true,
//     hasRun: false,
//     kind: 'effect',
//     schedule<T = unknown>(this: QueuexIfEffectNode, value: T, thenTmpRef: TemplateRef<T>) {
//       const prevConsumer = setActiveConsumer(null);
//       const priority = this.view._ifDir.qxIfPriority();
//       setActiveConsumer(prevConsumer);

//       scheduleChangeDetection(() => {

//       }, priority, this.view._thenViewRef);
//     }
//   }))();

// const QX_IF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_IF_DEFAULT_PRIORITY', { factory: () => Priority.Normal });

// export function provideQxIfDefaultPriority(priority: PriorityName): ValueProvider {
//   return { provide: QX_IF_DEFAULT_PRIORITY, useValue: priorityNameToNumber(priority) }
// }

// class ClientQxIfView<T = unknown> implements QxIfView {

//   ifDir: QueuexIf<T>
//   context: QueuexIfContext<T>;
//   thenWatcher: Watch;
//   elseWatcher: Watch;
//   thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
//   elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
//   thenTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
//   elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
//   thenTmpHasChange: boolean = false;
//   elseTmpHasChange: boolean = false
//   vcRef = inject(ViewContainerRef)

//   constructor(directive: QueuexIf<T>) {
//     this._ifDir = directive;
//     this._context = new QueuexIfContext(directive.qxIf);
//   }

//   dispose(): void {

//   }

//   private updateThenCase(value: T, thenTempRef: TemplateRef<QueuexIfContext<T>>) {
//     if (this.thenTmpRef !== thenTempRef) {
//       this.thenTmpRef = thenTempRef;
//       if (this.thenViewRef) {
//         const index = this._vcRef.indexOf(this.thenViewRef);
//         this.vcRef.remove(index);
//       }
//     }


//   }

// }

// class ServerQxIfView<T = unknown> implements QxIfView {

//   context: QueuexIfContext<T>;
//   thenViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
//   elseViewRef: EmbeddedViewRef<QueuexIfContext<T>> | null = null;
//   thenTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
//   elseTmpRef: TemplateRef<QueuexIfContext<T>> | null = null;
//   vcRef = inject(ViewContainerRef)

//   constructor(directive: QueuexIf<T>) {
//     this.context = new QueuexIfContext(directive.qxIf);
//     effect(() => {
//       this.update(
//         directive.qxIf(),
//         directive.qxIfThen(),
//         directive.qxIfElse()
//       )
//     })
//   }

//   private update(
//     value: T,
//     thenTmpRef: TemplateRef<QueuexIfContext<T>>,
//     elseTmpRef: TemplateRef<QueuexIfContext<T>> | null
//   ): void {
//     if (this.thenTmpRef !== thenTmpRef) {
//       this.thenTmpRef = thenTmpRef;
//       this.thenViewRef = null;
//     }

//     if (this.elseTmpRef !== elseTmpRef) {
//       this.elseTmpRef = elseTmpRef;
//       this.elseViewRef = null;
//     }

//     if (value) {
//       if (!this.thenViewRef) {
//         this.vcRef.clear();
//         this.elseViewRef = null;
//         this.thenViewRef = this.vcRef.createEmbeddedView(
//           this.thenTmpRef,
//           this.context
//         )
//       }
//     } else {
//       if (!this.elseViewRef) {
//         this.vcRef.clear();
//         this.thenViewRef = null;
//         if (this.elseTmpRef) {
//           this.elseViewRef = this.vcRef.createEmbeddedView(
//             this.elseTmpRef,
//             this.context
//           )
//         }
//       }
//     }

//   }

//   dispose(): void { /* noop */ }
// }

// @Directive({ selector: '[qxIf]' })
// export class QueuexIf<T = unknown> implements OnChanges, OnDestroy {
//   private _view: QxIfView

//   qxIfPriority = input(inject(QX_IF_DEFAULT_PRIORITY), { transform: priorityInputTransform });
//   qxIfThen: InputSignal<TemplateRef<QueuexIfContext<T>>> = input(inject(TemplateRef));
//   qxIfElse = input<TemplateRef<QueuexIfContext<T>> | null>(null);

//   @Input({ required: true }) qxIf: Signal<T> = null!

//   constructor() {
//     assertNgQueuexIntegrated();

//     if (isPlatformBrowser(inject(PLATFORM_ID))) {

//     } else {
//       this._view = new ServerQxIfView(this);
//     }

//   }

//   ngOnChanges(changes: SimpleChanges): void {
//     if (changes['qxIf']) {
//       throw new Error('[qxIf] Main input can not be change!');
//     }
//   }

//   ngOnDestroy(): void {
//     this._view.dispose();
//   }
// }

// export class QueuexIfContext<T = unknown> {

//   public $implicit: Signal<T>
//   public qxIf: Signal<T>

//   constructor(valueSignal: Signal<T>) {
//     this.$implicit = this.qxIf = valueSignal
//   }
// }
