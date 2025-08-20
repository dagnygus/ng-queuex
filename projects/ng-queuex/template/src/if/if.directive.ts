import { Directive, InjectionToken, input, InputSignal } from "@angular/core";
import { PriorityLevel, Priority } from "@ng-queuex/core";

const QX_IF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_IF_DEFAULT_PRIORITY', { factory: () => Priority.Normal });

@Directive({ selector: '[qxIf]' })
export class QueuexIf<T = unknown> {

  constructor() {
  }
}
