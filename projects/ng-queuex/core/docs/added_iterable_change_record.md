```ts
type AddedIterableChangeRecord<T> = IterableChangeRecord<T> & { readonly previousIndex: null; readonly currentIndex: number };
```
See also:
- [RemovedIterableChangeRecord](./removed_iterable_change_record.md)
- [StillPresentIterableChangeRecord](./still_present_iterable_change_record.md)
