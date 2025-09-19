## Declaration
```ts
export interface QueuexIterableChangeOperationHandler<T> {
  remove(record: RemovedIterableChangeRecord<T>, adjustedIndex: number): void;
  remove(record: RemovedIterableChangeRecord<T>, adjustedIndex: number): void;
  move(record: StillPresentIterableChangeRecord<T>, adjustedPreviousIndex: number, changed: boolean): void;
  noop(record: StillPresentIterableChangeRecord<T>, changed: boolean): void;
  done(): void;
}
```

### Description
A strategy for handling collection changes.

### Methods

**add(record: AddedIterableChangeRecord<T>): void**<br>
Handles a new added item. **Param:** record - Added record

**remove(record: RemovedIterableChangeRecord<T>, adjustedIndex: number): void**<br>
Handles a removed item.<br>
**Params:**
  - record - Removed record
  - adjustedIndex - Position from where item should be removed, adjusted to current changing state during iteration.

**move(record: StillPresentIterableChangeRecord<T>, adjustedPreviousIndex: number, changed: boolean): void**<br>
Handles a moved item.<br>
**Params:**
  - record - Moved record.
  - adjustedPreviousIndex - A previous position of item, adjusted to current changing state during iteration.
  - changed - True if identity has changed, otherwise false.

**noop(record: StillPresentIterableChangeRecord<T>, changed: boolean): void**<br>
It is invoked for item where you should not do changes to target state during iteration. To illustrate that, lets consider an array ['a', 'b', 'c] where 'b' was removed. There are two changes:<br>
1: 'b' is removed<br>
2: 'c' moved from index 2 to 1.<br>
During change providing , when on target array you remove second element, third one will already change position, so there is no need to made that change. However if target state relies on current item position, this hook can provide that handling.<br>
**Params:**
  record - Unchanged record.
  change - True if identity has changed, otherwise false.

**done(): void**<br>
This callback is called when iteration is finished.

See also:
- [QueuexIterableDiffer](./queuex_iterable_differ.md)
- [QueuexIterableDiffers](./queuex_iterable_differs.md)
- [QueuexIterableDifferFactory](./queuex_iterable_differ_factory.md)
- [QueuexIterableChanges](./queuex_iterable_changes.md)
- [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
- [AddedIterableChangeRecord](./addend_iterable_change_record.md)
- [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
