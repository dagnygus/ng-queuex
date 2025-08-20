import { Directive, InjectionToken, input, InputSignal } from "@angular/core";
import { PriorityLevel,  } from "@ng-queuex/core";

const QX_IF_DEFAULT_PRIORITY = new InjectionToken<PriorityLevel>('QX_IF_DEFAULT_PRIORITY', { factory: () => 3 });

@Directive({ selector: '[qxIf]' })
export class QueuexIf<T = unknown> {

  constructor() {
  }
}
