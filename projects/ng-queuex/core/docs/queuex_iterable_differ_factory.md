## Declaration
```ts
export interface QueuexIterableDifferFactory {
  supports(object: any): boolean;
  create<T>(trackByFn: TrackByFunction<T>): QueuexIterableDiffer<T>
}
```

See also:
  - [QueuexIterableDiffer](./queuex_iterable_differ.md)
  - [QueuexIterableDiffers](./queuex_iterable_differs.md)
  - [QueuexIterableChanges](./queuex_iterable_changes.md)
  - [QueuexIterableChangeOperationHandler](./queuex_iterable_change_operation_handler.md)
  - [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
  - [AddedIterableChangeRecord](./addend_iterable_change_record.md)
  - [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
