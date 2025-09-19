## Declaration
```ts
interface QueuexIterableChanges<T> {
  applyOperations(handler: QueuexIterableChangeOperationHandler<T>): void
  readonly length: number;
}
```
### Description
An object describing the changes in the `Iterable` collection since last time `QueuexIterableDiffer#diff()` was invoked.

### Methods
**applyOperations(handler: QueuexIterableChangeOperationHandler<T>): void**<br>
Provide changes to handler by iterating through all records (`IterableChangeRecord`). **Param:** : handler - An object that handles changes.

### Properties
**<span style="color: blue">readonly</span> length: number**<br>
A current state collection length, reflecting items count.

See also:
- [QueuexIterableDiffer](./queuex_iterable_differ.md)
- [QueuexIterableDiffers](./queuex_iterable_differs.md)
- [QueuexIterableDifferFactory](./queuex_iterable_differ_factory.md)
- [QueuexIterableChangeOperationHandler](./queuex_iterable_change_operation_handler.md)
- [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
- [AddedIterableChangeRecord](./addend_iterable_change_record.md)
- [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
