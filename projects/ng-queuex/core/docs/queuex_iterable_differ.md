## declaration
```ts
interface QueuexIterableDiffer<T> {
  diff(object: NgIterable<T> | undefined | null): QueuexIterableChanges<T> | null;
}
```
### Description
A strategy for tracking changes over time to an iterable.

**Methods:**
  - **diff(object: NgIterable<T> | undefined | null): QueuexIterableChanges<T> | null** Compute a difference between the previous state and the new `object` state.
  **Param:** object - containing the new value. **Returns:** an object describing the difference. The return value is only valid until the next `diff()` invocation.

See also:
  - [QueuexIterableDiffers](./queuex_iterable_differs.md)
  - [QueuexIterableDifferFactory](./queuex_iterable_differ_factory.md)
  - [QueuexIterableChanges](./queuex_iterable_changes.md)
  - [QueuexIterableChangeOperationHandler](./queuex_iterable_change_operation_handler.md)
  - [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
  - [AddedIterableChangeRecord](./addend_iterable_change_record.md)
  - [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
