import { inject, IterableChangeRecord, NgIterable, StaticProvider, TrackByFunction } from "@angular/core";
import { DefaultQueuexIterableDifferFactory } from "./default_iterable_differ";

/**
 * A strategy for tracking changes over time to an iterable.
 */
export interface QueuexIterableDiffer<T> {
  /**
   * Compute a difference between the previous state and the new `object` state.
   *
   * @param object containing the new value.
   * @returns an object describing the difference. The return value is only valid until the next
   * `diff()` invocation.
   */
  diff(object: NgIterable<T> | undefined | null): QueuexIterableChanges<T> | null;
}

/**
 * An object describing the changes in the `Iterable` collection since last time
 * `QueuexIterableDiffer#diff()` was invoked.
 */
export interface QueuexIterableChanges<T> {

  /**
   * Provide changes to handler by iterating through all records (`IterableChangeRecord`).
   * @param handler An object whats handle changes.
   * @see {@link IterableChangeRecord}
   */
  provideChanges(handler: QueuexIterableChangeHandler<T>): void

  /**
   * A current state collection length, reflecting items count.
   */
  readonly length: number;
}

/**
 * A strategy for handling collection changes.
 */
export interface QueuexIterableChangeHandler<T> {
  /**
   * Handles a new added item.
   * @param record Added record.
   * @param index Position where item should be inserted. Undefined if item should be appended.
   */
  add(record: IterableChangeRecord<T>, index: number | undefined): void;

  /**
   * Handles a removed item.
   * @param record Removed record
   * @param adjustedIndex Position from where item should be removed, adjusted to current changing state during iteration.
   */
  remove(record: IterableChangeRecord<T>, adjustedIndex: number): void;

  /**
   * Handles a moved item.
   * @param record Moved record.
   * @param adjustedPreviousIndex A previous position of item, adjusted to current changing state during iteration.
   * @param currentIndex A current position of item, where should be placed.
   * @param changed True if identity has changed, otherwise false.
   */
  move(record: IterableChangeRecord<T>, adjustedPreviousIndex: number, currentIndex: number, changed: boolean): void;

  /**
   * It is invoked for item where you should not do changes to target state during iteration. To illustrate that, lets
   * consider an array ['a', 'b', 'c] where 'b' was removed. There are two changes:
   *  1) 'b' is removed,
   *  2) 'c' moved from index 2 to 1.
   * During change providing , when on target array you remove second element, third one will already change position,
   * so there is no need to made that change. However if target state relies current item position, this hook can provide that handling.
   * @param record Unchanged record.
   * @param index Current position of item
   * @param changed True if identity has changed, otherwise false.
   */
  noop(record: IterableChangeRecord<T>, index: number, changed: boolean): void;

  /**
   * This callback is called when iteration is finished.
   */
  done(): void;
}


export interface QueuexIterableDifferFactory {
  supports(object: any): boolean;
  create<T>(trackByFn: TrackByFunction<T>): QueuexIterableDiffer<T>
}

export class QueuexIterableDiffers {

  constructor(private _factories: QueuexIterableDifferFactory[]) {}

  find(iterable: object): QueuexIterableDifferFactory {
    const factory = this._factories.find((f) => f.supports(iterable));
    if (factory) {
      return factory;
    } else {
      throw new Error(`Cannot find iterable change tracker for ${typeof iterable}!`);
    }
  }

  /**
   * Takes an array of {@link QueuexIterableDifferFactory} and returns a provider used to extend the
   * inherited {@link QueuexIterableDiffers} instance with the provided factories and return a new
   * {@link IterableDiffers} instance.
   *
   * @usageNotes
   * ### Example
   *
   * The following example shows how to extend an existing list of factories,
   * which will only be applied to the injector for this component and its children.
   * This step is all that's required to make a new {@link QueuexIterableDiffer} available.
   *
   * ```ts
   * @Component({
   *   viewProviders: [
   *     QueuexIterableDiffers.extend([new ImmutableListDiffer()])
   *   ]
   * })
   * ```
   */
  extend(factories: QueuexIterableDifferFactory[]): StaticProvider {
    return {
      provide: QueuexIterableDiffers,
      useFactory: () => {
        const parent = inject(QueuexIterableDiffers, { optional: true });
        // if parent is null, it means that we are in the root injector and we have just overridden
        // the default injection mechanism for QueuexIterableDiffers.
        return QueuexIterableDiffers._create(factories, parent || new QueuexIterableDiffers([new DefaultQueuexIterableDifferFactory()]))
      }
    }
  }

  private static _create(factories: QueuexIterableDifferFactory[], parent?: QueuexIterableDiffers): QueuexIterableDiffers {
    if (parent != null) {
      factories = factories.concat(parent._factories);
    }
    return new QueuexIterableDiffers(factories);
  }
}
