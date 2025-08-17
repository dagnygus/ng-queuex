import { IterableChangeRecord, NgIterable, TrackByFunction } from "@angular/core";
import { QueuexIterableChangeOperationHandler, QueuexIterableChanges, QueuexIterableDiffer, QueuexIterableDifferFactory } from "./iterable_differs";

const trackByIdentity = (_: number, item: any) => item;

function iterateListLike<T>(obj: Iterable<T>, fn: (p: T) => void) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      fn(obj[i]);
    }
  } else {
    const iterator = obj[Symbol.iterator]();
    let item: IteratorResult<T, any>;
    while (!(item = iterator.next()).done) {
      fn(item.value);
    }
  }
}

export class DefaultQueuexIterableDifferFactory implements QueuexIterableDifferFactory {
  supports(collection: any): boolean {
    return isListLikeIterable(collection)
  }
  create<T>(trackByFn?: TrackByFunction<T> | null | undefined): QueuexIterableDiffer<T> {
    trackByFn = trackByFn ?? trackByIdentity;
    return new DefaultQueuexIterableDiffer(trackByFn);
  }
}

export class DefaultQueuexIterableDiffer<T> implements QueuexIterableDiffer<T>, QueuexIterableChanges<T> {
  public readonly length: number = 0;
  // Keeps track of the used records at any point in time (during & across `_check()` calls)
  private _linkedRecords: _DuplicateMap<T>|null = null;
  // Keeps track of the removed records at any point in time during `_check()` calls.
  private _unlinkedRecords: _DuplicateMap<T>|null = null;
  // private _previousItHead: IterableChangeRecord_<T>|null = null;
  private _itHead: IterableChangeRecord_<T>|null = null;
  private _itTail: IterableChangeRecord_<T>|null = null;
  private _additionsHead: IterableChangeRecord_<T>|null = null;
  private _additionsTail: IterableChangeRecord_<T>|null = null;
  private _movesHead: IterableChangeRecord_<T>|null = null;
  private _movesTail: IterableChangeRecord_<T>|null = null;
  private _removalsHead: IterableChangeRecord_<T>|null = null;
  private _removalsTail: IterableChangeRecord_<T>|null = null;
  // Keeps track of records where custom track by is the same, but item identity has changed
  private _identityChangesHead: IterableChangeRecord_<T>|null = null;
  private _identityChangesTail: IterableChangeRecord_<T>|null = null;


  constructor(private _trackByFn: TrackByFunction<T>) {}

  applyOperations(handler: QueuexIterableChangeOperationHandler<T>): void {
    let nextIt = this._itHead;
    let nextRemove = this._removalsHead;
    let addRemoveOffset = 0;
    let moveOffsets: number[]|null = null;
    while (nextIt || nextRemove) {
      // Figure out which is the next record to process
      // Order: remove, add, move
      const record: IterableChangeRecord_<T> = !nextRemove ||
              nextIt &&
                  nextIt.currentIndex! <
                      getPreviousIndex(nextRemove, addRemoveOffset, moveOffsets) ?
          nextIt! :
          nextRemove;
      const adjPreviousIndex = getPreviousIndex(record, addRemoveOffset, moveOffsets);
      const currentIndex = record.currentIndex;

      // consume the item, and adjust the addRemoveOffset and update moveDistance if necessary
      if (record === nextRemove) {
        addRemoveOffset--;
        nextRemove = nextRemove._nextRemoved;
      } else {
        nextIt = nextIt!._next;
        if (record.previousIndex == null) {
          addRemoveOffset++;
        } else {
          // INVARIANT:  currentIndex < previousIndex
          if (!moveOffsets) moveOffsets = [];
          const localMovePreviousIndex = adjPreviousIndex - addRemoveOffset;
          const localCurrentIndex = currentIndex! - addRemoveOffset;
          if (localMovePreviousIndex != localCurrentIndex) {
            for (let i = 0; i < localMovePreviousIndex; i++) {
              const offset = i < moveOffsets.length ? moveOffsets[i] : (moveOffsets[i] = 0);
              const index = offset + i;
              if (localCurrentIndex <= index && index < localMovePreviousIndex) {
                moveOffsets[i] = offset + 1;
              }
            }
            const previousIndex = record.previousIndex;
            moveOffsets[previousIndex] = localCurrentIndex - localMovePreviousIndex;
          }
        }
      }

      if (adjPreviousIndex !== currentIndex) {
        if (record.previousIndex == null) {
          handler.add(record as any);
        } else if (currentIndex == null) {
          handler.remove(record as any, adjPreviousIndex);
        } else if (adjPreviousIndex !== null) {
          handler.move(record as any, adjPreviousIndex, record._isIdentityChange);
        }
      } else {
        handler.noop(record as any, record._isIdentityChange);
      }
    }
    handler.done();
  }

  diff(collection: NgIterable<T> | null | undefined): QueuexIterableChanges<T> | null {
    if (collection == null) collection = [];
    if (!isListLikeIterable(collection)) {
      throw new Error(`Error trying to diff '${JSON.stringify(collection)}'. Only arrays and iterables are allowed`,);
    }

    if (this._check(collection)) {
      return this;
    } else {
      return null;
    }
  }

  private _check(collection: NgIterable<T>): boolean {
    this._reset();

    let record: IterableChangeRecord_<T> | null = this._itHead;
    let mayBeDirty: boolean = false;
    let index: number;
    let item: T;
    let itemTrackBy: any;
    if (Array.isArray(collection)) {
      (this as { length: number }).length = collection.length;

      for (let index = 0; index < this.length; index++) {
        item = collection[index];
        itemTrackBy = this._trackByFn(index, item);
        if (record === null || !Object.is(record.trackById, itemTrackBy)) {
          record = this._mismatch(record, item, itemTrackBy, index);
          mayBeDirty = true;
        } else {
          if (mayBeDirty) {
            // TODO(misko): can we limit this to duplicates only?
            record = this._verifyReinsertion(record, itemTrackBy, index);
          }
          if (!Object.is(record.item, item)) this._addIdentityChange(record, item);
        }

        record = record._next;
      }
    } else {
      index = 0;
      iterateListLike(collection, (item: T) => {
        itemTrackBy = this._trackByFn(index, item);
        if (record === null || !Object.is(record.trackById, itemTrackBy)) {
          record = this._mismatch(record, item, itemTrackBy, index);
          mayBeDirty = true;
        } else {
          if (mayBeDirty) {
            // TODO(misko): can we limit this to duplicates only?
            record = this._verifyReinsertion(record, itemTrackBy, index);
          }
          if (!Object.is(record.item, item)) this._addIdentityChange(record, item);
        }
        record = record._next;
        index++;
      });
      (this as { length: number }).length = index;
    }

    this._truncate(record);

    return this._isDirty();
  }

  /* CollectionChanges is considered dirty if it has any additions, moves, removals, or identity
   * changes.
   */
  private _isDirty(): boolean {
    return !(this._removalsHead === null && this._additionsHead === null &&
        this._movesHead === null && this._identityChangesHead === null);
  }

  private _reset() {
    if (this._isDirty()) {
      let record: IterableChangeRecord_<T> | null;

      // for (record = this._previousItHead = this._itHead; record !== null; record = record._next) {
      //   record._nextPrevious = record._next;
      // }

      for (record = this._additionsHead; record !== null; record = record._nextAdded) {
        record.previousIndex = record.currentIndex;
      }
      this._additionsHead = this._additionsTail = null;

      for (record = this._movesHead; record !== null; record = record._nextMoved) {
        record.previousIndex = record.currentIndex;
      }
      for (record = this._identityChangesHead; record !== null; record = record._nextIdentityChange) {
        record._isIdentityChange = false;
      }
      this._movesHead = this._movesTail = null;
      this._removalsHead = this._removalsTail = null;
      this._identityChangesHead = this._identityChangesTail = null;

      // TODO(vicb): when assert gets supported
      // assert(!this.isDirty);
    }
  }

  /**
   * This is the core function which handles differences between collections.
   *
   * - `record` is the record which we saw at this position last time. If null then it is a new
   *   item.
   * - `item` is the current item in the collection
   * - `index` is the position of the item in the collection
   */
  private _mismatch(
    record: IterableChangeRecord_<T> | null,
    item: T,
    itemTrackBy: any,
    index: number,
  ): IterableChangeRecord_<T> {
    // The previous record after which we will append the current one.
    let previousRecord: IterableChangeRecord_<T> | null;

    if (record === null) {
      previousRecord = this._itTail;
    } else {
      previousRecord = record._prev;
      // Remove the record from the collection since we know it does not match the item.
      this._remove(record);
    }

    // See if we have evicted the item, which used to be at some anterior position of _itHead list.
    record = this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
    if (record !== null) {
      // It is an item which we have evicted earlier: reinsert it back into the list.
      // But first we need to check if identity changed, so we can update in view if necessary.
      if (!Object.is(record.item, item)) this._addIdentityChange(record, item);

      this._reinsertAfter(record, previousRecord, index);
    } else {
      // Attempt to see if the item is at some posterior position of _itHead list.
      record = this._linkedRecords === null ? null : this._linkedRecords.get(itemTrackBy, index);
      if (record !== null) {
        // We have the item in _itHead at/after `index` position. We need to move it forward in the
        // collection.
        // But first we need to check if identity changed, so we can update in view if necessary.
        if (!Object.is(record.item, item)) this._addIdentityChange(record, item);

        this._moveAfter(record, previousRecord, index);
      } else {
        // It is a new item: add it.
        record = this._addAfter(
          new IterableChangeRecord_<T>(item, itemTrackBy),
          previousRecord,
          index,
        );
      }
    }
    return record;
  }

  /**
   * This check is only needed if an array contains duplicates. (Short circuit of nothing dirty)
   *
   * Use case: `[a, a]` => `[b, a, a]`
   *
   * If we did not have this check then the insertion of `b` would:
   *   1) evict first `a`
   *   2) insert `b` at `0` index.
   *   3) leave `a` at index `1` as is. <-- this is wrong!
   *   3) reinsert `a` at index 2. <-- this is wrong!
   *
   * The correct behavior is:
   *   1) evict first `a`
   *   2) insert `b` at `0` index.
   *   3) reinsert `a` at index 1.
   *   3) move `a` at from `1` to `2`.
   *
   *
   * Double check that we have not evicted a duplicate item. We need to check if the item type may
   * have already been removed:
   * The insertion of b will evict the first 'a'. If we don't reinsert it now it will be reinserted
   * at the end. Which will show up as the two 'a's switching position. This is incorrect, since a
   * better way to think of it is as insert of 'b' rather then switch 'a' with 'b' and then add 'a'
   * at the end.
   *
   * @internal
   */
  private _verifyReinsertion(
    record: IterableChangeRecord_<T>,
    // item: T,
    itemTrackBy: any,
    index: number,
  ): IterableChangeRecord_<T> {
    let reinsertRecord: IterableChangeRecord_<T> | null =
      this._unlinkedRecords === null ? null : this._unlinkedRecords.get(itemTrackBy, null);
    if (reinsertRecord !== null) {
      record = this._reinsertAfter(reinsertRecord, record._prev!, index);
    } else if (record.currentIndex != index) {
      record.currentIndex = index;
      this._addToMoves(record, index);
    }
    return record;
  }

  /**
   * Get rid of any excess {@link IterableChangeRecord_}s from the previous collection
   *
   * - `record` The first excess {@link IterableChangeRecord_}.
   *
   */
  private _truncate(record: IterableChangeRecord_<T> | null) {
    // Anything after that needs to be removed;
    while (record !== null) {
      const nextRecord: IterableChangeRecord_<T> | null = record._next;
      this._addToRemovals(this._unlink(record));
      record = nextRecord;
    }
    if (this._unlinkedRecords !== null) {
      this._unlinkedRecords.clear();
    }

    if (this._additionsTail !== null) {
      this._additionsTail._nextAdded = null;
    }
    if (this._movesTail !== null) {
      this._movesTail._nextMoved = null;
    }
    if (this._itTail !== null) {
      this._itTail._next = null;
    }
    if (this._removalsTail !== null) {
      this._removalsTail._nextRemoved = null;
    }
    if (this._identityChangesTail !== null) {
      this._identityChangesTail._nextIdentityChange = null;
    }
  }

  private _reinsertAfter(
    record: IterableChangeRecord_<T>,
    prevRecord: IterableChangeRecord_<T> | null,
    index: number,
  ): IterableChangeRecord_<T> {
    if (this._unlinkedRecords !== null) {
      this._unlinkedRecords.remove(record);
    }
    const prev = record._prevRemoved;
    const next = record._nextRemoved;

    if (prev === null) {
      this._removalsHead = next;
    } else {
      prev._nextRemoved = next;
    }
    if (next === null) {
      this._removalsTail = prev;
    } else {
      next._prevRemoved = prev;
    }

    this._insertAfter(record, prevRecord, index);
    this._addToMoves(record, index);
    return record;
  }

  private _moveAfter(
    record: IterableChangeRecord_<T>,
    prevRecord: IterableChangeRecord_<T> | null,
    index: number,
  ): IterableChangeRecord_<T> {
    this._unlink(record);
    this._insertAfter(record, prevRecord, index);
    this._addToMoves(record, index);
    return record;
  }

  private _addAfter(
    record: IterableChangeRecord_<T>,
    prevRecord: IterableChangeRecord_<T> | null,
    index: number,
  ): IterableChangeRecord_<T> {
    this._insertAfter(record, prevRecord, index);

    if (this._additionsTail === null) {
      // TODO(vicb):
      // assert(this._additionsHead === null);
      this._additionsTail = this._additionsHead = record;
    } else {
      // TODO(vicb):
      // assert(_additionsTail._nextAdded === null);
      // assert(record._nextAdded === null);
      this._additionsTail = this._additionsTail._nextAdded = record;
    }
    return record;
  }

  private _insertAfter(
    record: IterableChangeRecord_<T>,
    prevRecord: IterableChangeRecord_<T> | null,
    index: number,
  ): IterableChangeRecord_<T> {
    // TODO(vicb):
    // assert(record != prevRecord);
    // assert(record._next === null);
    // assert(record._prev === null);

    const next: IterableChangeRecord_<T> | null =
      prevRecord === null ? this._itHead : prevRecord._next;
    // TODO(vicb):
    // assert(next != record);
    // assert(prevRecord != record);
    record._next = next;
    record._prev = prevRecord;
    if (next === null) {
      this._itTail = record;
    } else {
      next._prev = record;
    }
    if (prevRecord === null) {
      this._itHead = record;
    } else {
      prevRecord._next = record;
    }

    if (this._linkedRecords === null) {
      this._linkedRecords = new _DuplicateMap<T>();
    }
    this._linkedRecords.put(record);

    record.currentIndex = index;
    return record;
  }


  private _remove(record: IterableChangeRecord_<T>): IterableChangeRecord_<T> {
    return this._addToRemovals(this._unlink(record));
  }


  private _unlink(record: IterableChangeRecord_<T>): IterableChangeRecord_<T> {
    if (this._linkedRecords !== null) {
      this._linkedRecords.remove(record);
    }

    const prev = record._prev;
    const next = record._next;

    // TODO(vicb):
    // assert((record._prev = null) === null);
    // assert((record._next = null) === null);

    if (prev === null) {
      this._itHead = next;
    } else {
      prev._next = next;
    }
    if (next === null) {
      this._itTail = prev;
    } else {
      next._prev = prev;
    }

    return record;
  }


  private  _addToMoves(record: IterableChangeRecord_<T>, toIndex: number): IterableChangeRecord_<T> {
    // TODO(vicb):
    // assert(record._nextMoved === null);

    if (record.previousIndex === toIndex) {
      return record;
    }

    if (this._movesTail === null) {
      // TODO(vicb):
      // assert(_movesHead === null);
      this._movesTail = this._movesHead = record;
    } else {
      // TODO(vicb):
      // assert(_movesTail._nextMoved === null);
      this._movesTail = this._movesTail._nextMoved = record;
    }

    return record;
  }

  private _addToRemovals(record: IterableChangeRecord_<T>): IterableChangeRecord_<T> {
    if (this._unlinkedRecords === null) {
      this._unlinkedRecords = new _DuplicateMap<T>();
    }
    this._unlinkedRecords.put(record);
    record.currentIndex = null;
    record._nextRemoved = null;

    if (this._removalsTail === null) {
      // TODO(vicb):
      // assert(_removalsHead === null);
      this._removalsTail = this._removalsHead = record;
      record._prevRemoved = null;
    } else {
      // TODO(vicb):
      // assert(_removalsTail._nextRemoved === null);
      // assert(record._nextRemoved === null);
      record._prevRemoved = this._removalsTail;
      this._removalsTail = this._removalsTail._nextRemoved = record;
    }
    return record;
  }


  private _addIdentityChange(record: IterableChangeRecord_<T>, item: T) {
    record.item = item;
    record._isIdentityChange = true
    if (this._identityChangesTail === null) {
      this._identityChangesTail = this._identityChangesHead = record;
    } else {
      this._identityChangesTail = this._identityChangesTail._nextIdentityChange = record;
    }
    return record;
  }
}

class _DuplicateItemRecordList<T> {
  /** @internal */
  _head: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _tail: IterableChangeRecord_<T>|null = null;

  /**
   * Append the record to the list of duplicates.
   *
   * Note: by design all records in the list of duplicates hold the same value in record.item.
   */
  add(record: IterableChangeRecord_<T>): void {
    if (this._head === null) {
      this._head = this._tail = record;
      record._nextDup = null;
      record._prevDup = null;
    } else {
      // TODO(vicb):
      // assert(record.item ==  _head.item ||
      //       record.item is num && record.item.isNaN && _head.item is num && _head.item.isNaN);
      this._tail!._nextDup = record;
      record._prevDup = this._tail;
      record._nextDup = null;
      this._tail = record;
    }
  }

  // Returns a IterableChangeRecord_ having IterableChangeRecord_.trackById == trackById and
  // IterableChangeRecord_.currentIndex >= atOrAfterIndex
  get(trackById: any, atOrAfterIndex: number|null): IterableChangeRecord_<T>|null {
    let record: IterableChangeRecord_<T>|null;
    for (record = this._head; record !== null; record = record._nextDup) {
      if ((atOrAfterIndex === null || atOrAfterIndex <= record.currentIndex!) &&
          Object.is(record.trackById, trackById)) {
        return record;
      }
    }
    return null;
  }

  /**
   * Remove one {@link IterableChangeRecord_} from the list of duplicates.
   *
   * Returns whether the list of duplicates is empty.
   */
  remove(record: IterableChangeRecord_<T>): boolean {

    const prev: IterableChangeRecord_<T>|null = record._prevDup;
    const next: IterableChangeRecord_<T>|null = record._nextDup;
    if (prev === null) {
      this._head = next;
    } else {
      prev._nextDup = next;
    }
    if (next === null) {
      this._tail = prev;
    } else {
      next._prevDup = prev;
    }
    return this._head === null;
  }
}

class _DuplicateMap<T> {
  map = new Map<any, _DuplicateItemRecordList<T>>();

  put(record: IterableChangeRecord_<T>) {
    const key = record.trackById;

    let duplicates = this.map.get(key);
    if (!duplicates) {
      duplicates = new _DuplicateItemRecordList<T>();
      this.map.set(key, duplicates);
    }
    duplicates.add(record);
  }

  /**
   * Retrieve the `value` using key. Because the IterableChangeRecord_ value may be one which we
   * have already iterated over, we use the `atOrAfterIndex` to pretend it is not there.
   *
   * Use case: `[a, b, c, a, a]` if we are at index `3` which is the second `a` then asking if we
   * have any more `a`s needs to return the second `a`.
   */
  get(trackById: any, atOrAfterIndex: number|null): IterableChangeRecord_<T>|null {
    const key = trackById;
    const recordList = this.map.get(key);
    return recordList ? recordList.get(trackById, atOrAfterIndex) : null;
  }

  /**
   * Removes a {@link IterableChangeRecord_} from the list of duplicates.
   *
   * The list of duplicates also is removed from the map if it gets empty.
   */
  remove(record: IterableChangeRecord_<T>): IterableChangeRecord_<T> {
    const key = record.trackById;
    const recordList: _DuplicateItemRecordList<T> = this.map.get(key)!;
    // Remove the list of duplicates when it gets empty
    if (recordList.remove(record)) {
      this.map.delete(key);
    }
    return record;
  }

  get isEmpty(): boolean {
    return this.map.size === 0;
  }

  clear() {
    this.map.clear();
  }
}


class IterableChangeRecord_<T> implements IterableChangeRecord<T> {
  currentIndex: number|null = null;
  previousIndex: number|null = null;

  /** @internal */
  _nextPrevious: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _prev: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _next: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _prevDup: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _nextDup: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _prevRemoved: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _nextRemoved: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _nextAdded: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _nextMoved: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _nextIdentityChange: IterableChangeRecord_<T>|null = null;
  /** @internal */
  _isIdentityChange = false


  constructor(public item: T, public trackById: any) {}
}

function getPreviousIndex(item: any, addRemoveOffset: number, moveOffsets: number[]|null): number {
  const previousIndex = item.previousIndex;
  if (previousIndex === null) return previousIndex;
  let moveOffset = 0;
  if (moveOffsets && previousIndex < moveOffsets.length) {
    moveOffset = moveOffsets[previousIndex];
  }
  return previousIndex + addRemoveOffset + moveOffset;
}

function isListLikeIterable(obj: any): boolean {
  if (!isJsObject(obj)) return false;
  return Array.isArray(obj) ||
      (!(obj instanceof Map) &&  // JS Map are iterables but return entries as [k, v]
       Symbol.iterator in obj);  // JS Iterable have a Symbol.iterator prop
}

export function isJsObject(o: any): boolean {
  return o !== null && (typeof o === 'function' || typeof o === 'object');
}
