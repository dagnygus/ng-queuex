import { NgModule } from "@angular/core";
import { QueuexIf } from "./if/if.directive";
import { QueuexForOf } from "./for/for.directive";
import { QueuexSwitch, QueuexSwitchCase, QueuexSwitchDefault } from "./switch/switch.directive";
import { QueuexReactiveView } from "./reactive_view/reactive_view";
import { QueuexLazyView } from "./lazy_view/lazy_view";
import { QueuexWatch } from "./watch/watch.directive";
import { NgForOf } from "@angular/common";

export {
  QueuexForOf,
  provideQueuexForOfDefaultPriority
} from './for/for.directive';
export type {
  Num,
  Flatten,
  KeysToUse,
  PrefixedKeys,
  TrackBy,
  QueuexForOfInput,
  QueuexForOfContext,
} from './for/for.directive';
export {
  QueuexIf,
  QueuexIfContext,
  provideQueuexIfDefaultPriority
} from './if/if.directive';
export {
  QueuexLazyView
} from './lazy_view/lazy_view';
export {
  QueuexReactiveView,
  provideQueuexReactiveViewDefaultPriority
} from './reactive_view/reactive_view';
export {
  QueuexSwitch,
  QueuexSwitchCase,
  QueuexSwitchDefault,
  // QueuexSwitchModule,
  provideQueuexSwitchDefaultPriority
} from './switch/switch.directive';
export {
  QueuexWatch
} from './watch/watch.directive';

// const imports = [
//   QueuexIf,
//   QueuexForOf,
//   QueuexSwitch,
//   QueuexSwitchCase,
//   QueuexSwitchDefault,
//   QueuexReactiveView,
//   QueuexLazyView,
//   QueuexWatch
// ];

// @NgModule({
//   imports: imports,
//   exports: imports
// })
// export class QueuexTemplateModule {}
