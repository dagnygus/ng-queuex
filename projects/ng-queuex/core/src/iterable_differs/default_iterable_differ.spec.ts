import { IterableChangeRecord } from "@angular/core";
import { QueuexIterableChanges } from "./iterable_differs";
import { DefaultQueuexIterableDiffer, DefaultQueuexIterableDifferFactory } from "./default_iterable_differ";

const UNDEFINED_PLACEHOLDER = `ɵɵUNDEFINED_PLACEHOLDER_JSON`;
const UNDEFINED_PLACEHOLDER_REGEX = new RegExp(`["']${UNDEFINED_PLACEHOLDER}["']`, 'g');

export function stringify(value: any) {
  let result: string;

  if (value instanceof ItemWithId || value instanceof ComplexItem) { return value.toString(); }

  if (typeof value === 'string') {
    result = value
  } else if(Number.isNaN(value)) {
    result = 'NaN'
  } else {
    result = JSON.stringify(value, (_, value) =>
      value === undefined ? UNDEFINED_PLACEHOLDER : value,
    );
  }

  UNDEFINED_PLACEHOLDER_REGEX.lastIndex = 0;

  return result.replace(UNDEFINED_PLACEHOLDER_REGEX, 'undefined');
}

function icrAsString<T>(icr: IterableChangeRecord<T>): string {
  return icr.previousIndex === icr.currentIndex
    ? stringify(icr.item)
    : stringify(icr.item) +
        '[' +
        stringify(icr.previousIndex) +
        '->' +
        stringify(icr.currentIndex) +
        ']';
}

function iterableChangesAsString({
  collection = [] as any,
  additions = [] as any,
  moves = [] as any,
  removals = [] as any,
  identityChanges = [] as any,
  noops = [] as any
}): string {
  return (
    'collection: ' +
    collection.join(', ') +
    '\n' +
    'additions: ' +
    additions.join(', ') +
    '\n' +
    'moves: ' +
    moves.join(', ') +
    '\n' +
    'removals: ' +
    removals.join(', ') +
    '\n' +
    'identityChanges: ' +
    identityChanges.join(', ') +
    '\n' +
    'noops: ' +
    noops.join(', ') +
    '\n'
  );
}

function iterableDifferToString<T>(iterableChanges: QueuexIterableChanges<T>): string {
  const collection: string[] = [];
  const additions: string[] = [];
  const moves: string[] = [];
  const removals: string[] = [];
  const identityChanges: string[] = [];
  const noops: string[] = [];

  iterableChanges.applyOperations({
    add(record) {
      const icrStr = icrAsString(record);
      collection.push(icrStr);
      additions.push(icrStr);
    },
    move(record, _, changed) {
      const icrStr = icrAsString(record);
      collection.push(icrStr);
      moves.push(icrStr);
      if (changed) {
        identityChanges.push(icrStr);
      }
    },
    remove(record) {
      const icrStr = icrAsString(record);
      removals.push(icrStr);
    },
    noop(record, changed) {
      const icrStr = icrAsString(record);
      collection.push(icrStr);
      noops.push(icrStr);
      if (changed) {
        identityChanges.push(icrStr)
      }
    },
    done() {}
  });

  return iterableChangesAsString({
    collection,
    additions,
    moves,
    removals,
    identityChanges,
    noops
  })
}

class TestIterable {
  list: number[];
  constructor() {
    this.list = [];
  }

  [Symbol.iterator]() {
    return this.list[Symbol.iterator]();
  }
}

class ItemWithId {
  constructor(private id: string) {}

  toString() {
    return `{id: ${this.id}}`;
  }
}

class ComplexItem {
  constructor(
    private id: string,
    private color: string,
  ) {}

  toString() {
    return `{id: ${this.id}, color: ${this.color}}`;
  }
}

const trackByIdentity = (_: number, item: any) => item;

describe('A default QueuexIterableDiffer.', () => {
  let differ: DefaultQueuexIterableDiffer<any>;

  beforeEach(() => {
    differ = new DefaultQueuexIterableDiffer(trackByIdentity);
  });

  it('Should support list and iterables.', () => {
    const factory = new DefaultQueuexIterableDifferFactory();
    expect(factory.supports([])).toBeTrue();
    expect(factory.supports(new TestIterable())).toBeTruthy();
    expect(factory.supports(new Map())).toBeFalsy();
    expect(factory.supports(null)).toBeFalsy();
  });

  it('Should support iterables.', () => {
    const iterable = new TestIterable();

    differ.diff(iterable);
    expect(iterableDifferToString(differ)).toEqual(iterableChangesAsString({collection: []}));

    iterable.list = [1];
    differ.diff(iterable);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({collection: ['1[null->0]'], additions: ['1[null->0]']}),
    );

    iterable.list = [2, 1];

    iterable.list = [2, 1];
    differ.diff(iterable);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['2[null->0]', '1[0->1]'],
        additions: ['2[null->0]'],
        noops: ['1[0->1]']
      }),
    );
  });

  it('Should detect additions.', () => {
    const list: any[] = [];
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(iterableChangesAsString({collection: []}));

    list.push('a');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({collection: ['a[null->0]'], additions: ['a[null->0]']}),
    );

    list.push('b');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b[null->1]'],
        additions: ['b[null->1]'],
        noops: ['a']
      }),
    );
  });

  it('Should support changing reference.', () => {
    let list = [0];
    differ.diff(list);

    list = [1, 0];
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['1[null->0]', '0[0->1]'],
        additions: ['1[null->0]'],
        noops: ['0[0->1]']
      })
    );

    list = [2, 1, 0];
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['2[null->0]', '1[0->1]', '0[1->2]'],
        additions: ['2[null->0]'],
        noops: ['1[0->1]', '0[1->2]']
      })
    );
  });

  it('Should handle swapping elements.', () => {
    const list = [1, 2];
    differ.diff(list);

    list.length = 0;
    list.push(2);
    list.push(1);
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['2[1->0]', '1[0->1]'],
        moves: ['2[1->0]'],
        noops: ['1[0->1]']
      })
    )
  });

  it('Should handle incremental swapping elements.', () => {
    const list = ['a', 'b', 'c'];
    differ.diff(list);

    list.splice(1, 1);
    list.splice(0, 0, 'b');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['b[1->0]', 'a[0->1]', 'c'],
        moves: ['b[1->0]'],
        noops: ['a[0->1]', 'c']
      })
    );

    list.splice(1, 1);
    list.push('a');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['b', 'c[2->1]', 'a[1->2]'],
        moves: ['c[2->1]'],
        noops: ['b', 'a[1->2]']
      })
    );
  });

  it('Should detect changes in list.', () => {
    const list: any[] = [];
    differ.diff(list);

    list.push('a');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a[null->0]'],
        additions: ['a[null->0]']
      })
    );

    list.push('b');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b[null->1]'],
        additions: ['b[null->1]'],
        noops: ['a']
      })
    );

    list.push('c');
    list.push('d');
    differ.diff(list)
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b', 'c[null->2]', 'd[null->3]'],
        additions: ['c[null->2]', 'd[null->3]'],
        noops: ['a', 'b']
      })
    );

    list.splice(2, 1)
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b', 'd[3->2]'],
        removals: ['c[2->null]'],
        noops: ['a', 'b', 'd[3->2]']
      })
    );

    list.length = 0;
    list.push('d');
    list.push('c');
    list.push('b');
    list.push('a');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['d[2->0]', 'c[null->1]', 'b[1->2]', 'a[0->3]'],
        additions: ['c[null->1]'],
        moves: ['d[2->0]', 'b[1->2]'],
        noops: ['a[0->3]'],
      })
    );
  });

  it('Should detect NaN moves', () => {
    const list: any[] = [NaN, NaN];
    differ.diff(list);

    list.unshift('foo');
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['foo[null->0]', 'NaN[0->1]', 'NaN[1->2]'],
        additions: ['foo[null->0]'],
        noops: ['NaN[0->1]', 'NaN[1->2]']
      })
    );
  });

  it('Should remove and add same item', () => {
    const list = ['a', 'b', 'c'];
    differ.diff(list);

    list.splice(1, 1) //removing b;
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'c[2->1]'],
        removals: ['b[1->null]'],
        noops: ['a', 'c[2->1]'],
      })
    );

    list.splice(1, 0, 'b');
    differ.diff(list)
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b[null->1]', 'c[1->2]'],
        additions: ['b[null->1]'],
        noops: ['a', 'c[1->2]']
      })
    );
  });

  it('Should supports duplicates.', () => {
    const list = ['a', 'a', 'a', 'b', 'b'];
    differ.diff(list);

    list.splice(0, 1);
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'a', 'b[3->2]', 'b[4->3]'],
        noops: ['a', 'a', 'b[3->2]', 'b[4->3]'],
        removals: ['a[2->null]']
      })
    );
  });

  it('Should support insertions/moves', () => {
    const list = ['a', 'a', 'b', 'b'];
    differ.diff(list);

    list.splice(0, 0, 'b');
    differ.diff(list)
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['b[2->0]', 'a[0->1]', 'a[1->2]', 'b', 'b[null->4]'],
        additions: ['b[null->4]'],
        moves: ['b[2->0]'],
        noops: ['a[0->1]', 'a[1->2]', 'b']
      })
    );
  });

  it('Should not report unnecessary moves', () => {
    const list = ['a', 'b', 'c'];
    differ.diff(list);

    list.length = 0;
    list.push('b');
    list.push('a');
    list.push('c');
    differ.diff(list);

    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['b[1->0]', 'a[0->1]', 'c'],
        moves: ['b[1->0]'],
        noops: ['a[0->1]', 'c']
      })
    )
  });

  it('Support reinsertion', () => {
    const list = ['a', '*', '*', 'd', '-', '-', '-', 'e'];
    differ.diff(list);
    list[1] = 'b';
    list[5] = 'c';
    differ.diff(list);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['a', 'b[null->1]', '*[1->2]', 'd', '-', 'c[null->5]', '-[5->6]', 'e'],
        removals: ['*[2->null]', '-[6->null]'],
        additions: ['b[null->1]', 'c[null->5]'],
        noops: ['a', '*[1->2]', 'd', '-', '-[5->6]', 'e']
      })
    );
  });

  function operationsFrom(changes: QueuexIterableChanges<any>): string[] {
    const operations: string[] = [];

    changes.applyOperations({
      add(record) {
        operations.push(`INSERT ${stringify(record.item)}[void->${record.currentIndex}]`);
      },
      move(record, adjPrevIndex) {
        operations.push(`MOVE ${stringify(record.item)}[${adjPrevIndex}->${record.currentIndex}]`);
      },
      remove(record, adjustedIndex) {
        operations.push(`REMOVE ${stringify(record.item)}[${adjustedIndex}->void]`)
      },
      noop(record) {
        operations.push(`NOOP ${stringify(record.item)}[at ${record.currentIndex}]`)
      },
      done() {
        operations.push('DONE');
      }
    })

    return operations;
  }

  it('Should trigger a series of insert/move/remove changes for inputs that have been diffed', () => {
    const startData = [0, 1, 2, 3, 4, 5];
    const endData = [6, 2, 7, 0, 4, 8];

    differ.diff(startData);
    differ.diff(endData);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['6[null->0]', '2[2->1]', '7[null->2]', '0[0->3]', '4', '8[null->5]'],
        additions: ['6[null->0]', '7[null->2]', '8[null->5]'],
        moves: ['2[2->1]',],
        removals: ['1[1->null]', '3[3->null]', '5[5->null]'],
        noops: ['0[0->3]', '4',]
      })
    );

    expect(operationsFrom(differ)).toEqual([
      'INSERT 6[void->0]',
      'MOVE 2[3->1]',
      'INSERT 7[void->2]',
      'NOOP 0[at 3]',
      'REMOVE 1[4->void]',
      'REMOVE 3[4->void]',
      'NOOP 4[at 4]',
      'REMOVE 5[5->void]',
      'INSERT 8[void->5]',
      'DONE'
    ])
  });


  it('Should consider inserting/removing/moving items with respect to items that have not moved at all', () => {
    const startData = [0, 1, 2, 3];
    const endData = [2, 1];

    differ.diff(startData);
    differ.diff(endData);

    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['2[2->0]', '1'],
        removals: ['0[0->null]', '3[3->null]'],
        moves: ['2[2->0]'],
        noops: ['1']
      })
    );

    expect(operationsFrom(differ)).toEqual([
      'REMOVE 0[0->void]',
      'MOVE 2[1->0]',
      'NOOP 1[at 1]',
      'REMOVE 3[2->void]',
      'DONE'
    ])
  });


  it('Should be able to manage operations within a criss/cross of move operations', () => {
    const startData = [1, 2, 3, 4, 5, 6]; // [3 6 4 9 1 2]
    const endData = [3, 6, 4, 9, 1, 2]; //   [0 1 2 3 4 5]

    differ.diff(startData);
    differ.diff(endData);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['3[2->0]', '6[5->1]', '4[3->2]', '9[null->3]', '1[0->4]', '2[1->5]'],
        removals: ['5[4->null]'],
        additions: ['9[null->3]'],
        moves: ['3[2->0]', '6[5->1]', '4[3->2]'],
        noops: ['1[0->4]', '2[1->5]']
      })
    );

    expect(operationsFrom(differ)).toEqual([
      'MOVE 3[2->0]',
      'MOVE 6[5->1]',
      'MOVE 4[4->2]',
      'INSERT 9[void->3]',
      'NOOP 1[at 4]',
      'NOOP 2[at 5]',
      'REMOVE 5[6->void]',
      'DONE'
    ]);
  });

  it('Should skip moves for multiple nodes that have not moved.', () => {
    const startData = [0, 1, 2, 3, 4];
    const endData = [4, 1, 2, 3, 0, 5];

    differ.diff(startData);
    differ.diff(endData);
    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['4[4->0]', '1', '2', '3', '0[0->4]', '5[null->5]'],
        moves: ['4[4->0]', '1', '2', '3', ],
        additions: ['5[null->5]'],
        noops: ['0[0->4]']
      })
    );

    expect(operationsFrom(differ)).toEqual([
      'MOVE 4[4->0]',
      'MOVE 1[2->1]',
      'MOVE 2[3->2]',
      'MOVE 3[4->3]',
      'NOOP 0[at 4]',
      'INSERT 5[void->5]',
      'DONE'
    ])
  });

  it('Should not fail.', () => {
    const startData = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; //[X Y 1 5 7 8 0 5 3 6]
    const endData =  [10, 11, 1, 5, 7, 8, 0, 5, 3, 6];        //[0 1 2 3 4 5 6 7 8 9 X Y]

    differ.diff(startData);
    differ.diff(endData);

    expect(iterableDifferToString(differ)).toEqual(
      iterableChangesAsString({
        collection: ['10[10->0]', '11[11->1]', '1[1->2]', '5[5->3]', '7[7->4]', '8[8->5]', '0[0->6]', '5[null->7]', '3[3->8]', '6[6->9]'],
        removals: ['2[2->null]', '4[4->null]', '9[9->null]'],
        additions: ['5[null->7]'],
        moves: ['10[10->0]', '11[11->1]', '1[1->2]', '5[5->3]', '7[7->4]', '8[8->5]'],
        noops: ['0[0->6]', '3[3->8]', '6[6->9]']
      })
    );

    expect(operationsFrom(differ)).toEqual([
      'MOVE 10[10->0]',
      'MOVE 11[11->1]',
      'MOVE 1[3->2]',
      'MOVE 5[7->3]',
      'MOVE 7[9->4]',
      'MOVE 8[10->5]',
      'NOOP 0[at 6]',
      'REMOVE 2[7->void]',
      'INSERT 5[void->7]',
      'NOOP 3[at 8]',
      'REMOVE 4[9->void]',
      'NOOP 6[at 9]',
      'REMOVE 9[10->void]',
      'DONE'
    ])
  });

  it('Should previous index to be equal current index and be of type number if there are no changes', () => {
    const list = [0, 1, 2, 3, 4, 5, 6];
    let noopsCount = 0;
    differ.diff(list);
    differ.diff(list);

    differ.applyOperations({
      add() {},
      remove() {},
      move() {},
      noop(record) {
        expect(record.currentIndex).toBe(record.previousIndex);
        expect(typeof record.previousIndex).toBe('number');
        noopsCount++;
      },
      done() {}
    })

    expect(noopsCount).toBe(7);
  });

  it('Should previous and current index be type number after move.', () => {
    const list1 = [0, 1, 2, 3, 4, 5, 6];
    const list2 = [0, 1, 2, 6, 3, 4, 5];
    let noopsCount = 0;
    let moveCount = 0;
    differ.diff(list1);
    differ.diff(list2);

    differ.applyOperations({
      add() {},
      remove() {},
      move(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(typeof record.currentIndex).toBe('number');
        moveCount++;
      },
      noop(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(typeof record.currentIndex).toBe('number');
        noopsCount++;
      },
      done() {}
    })

    expect(noopsCount).toBe(6);
    expect(moveCount).toBe(1);
  });

  it('Should previous index be of type number and current to be null for removed item', () => {
    const list1 = [0, 1, 2, 3, 4, 5, 6];
    const list2 = [0, 2, 3, 4, 5];
    let noopsCount = 0;
    let removeCount = 0;
    differ.diff(list1);
    differ.diff(list2);

    differ.applyOperations({
      add() {},
      remove(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(record.currentIndex).toBeNull();
        removeCount++;
      },
      move() {},
      noop(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(typeof record.currentIndex).toBe('number');
        noopsCount++;
      },
      done() {}
    })

    expect(noopsCount).toBe(5);
    expect(removeCount).toBe(2);
  });

  it('Should previous index to be null and current index to be of type number for inserted item (not appended!)', () => {
    const list1 = [0, 1, 2, 3, 4, 5, 6];
    const list2 = [0, 1, 2, 3, 7, 4, 5, 6];
    let noopsCount = 0;
    let additionsCount = 0;
    differ.diff(list1);
    differ.diff(list2);

     differ.applyOperations({
      add(record) {
        expect(record.previousIndex).toBeNull();
        expect(typeof record.currentIndex).toBe('number');
        additionsCount++;
      },
      remove() {},
      move() {},
      noop(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(typeof record.currentIndex).toBe('number');
        noopsCount++;
      },
      done() {}
    })

    expect(noopsCount).toBe(7);
    expect(additionsCount).toBe(1);
  });

  it('Should Should previous index to be null and current index to be of type number for appended item', () => {
    const list1 = [0, 1, 2, 3, 4, 5, 6];
    const list2 = [0, 1, 2, 3, 4, 5, 6, 7];
    let noopsCount = 0;
    let additionsCount = 0;
    differ.diff(list1);
    differ.diff(list2);

     differ.applyOperations({
      add(record) {
        expect(record.previousIndex).toBeNull();
        expect(typeof record.currentIndex).toBe('number');
        additionsCount++;
      },
      remove() {},
      move() {},
      noop(record) {
        expect(typeof record.previousIndex).toBe('number');
        expect(typeof record.currentIndex).toBe('number');
        noopsCount++;
      },
      done() {}
    })

    expect(noopsCount).toBe(7);
    expect(additionsCount).toBe(1);
  })

  it('Should trigger nothing when the list is completely full of replaced items that are tracked by the index', () => {
    differ = new DefaultQueuexIterableDiffer((index) => index);
    const startData = [1, 2, 3, 4];
    const endData = [5, 6, 7, 8];

    differ.diff(startData)!;
    differ.diff(endData)!;

    expect(iterableDifferToString(differ)).toEqual(iterableChangesAsString({
      collection: ['5', '6', '7', '8'],
      identityChanges: ['5', '6', '7', '8'],
      noops: ['5', '6', '7', '8']
    }));

    expect(operationsFrom(differ)).toEqual([
      'NOOP 5[at 0]',
      'NOOP 6[at 1]',
      'NOOP 7[at 2]',
      'NOOP 8[at 3]',
      'DONE'
    ]);
  });

  describe('Diff.', () => {

    it('Should return self when there are changes.', () => {
      expect(differ.diff(['a', 'b'])).toBe(differ);
    });

    it('Should return null where there are no changes', () => {
      differ.diff(['a', 'b']);
      expect(differ.diff(['a', 'b'])).toBeNull();
    });

    it('Should thread null as empty list', () => {
      differ.diff(['a', 'b']);
      differ.diff(null);
      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          removals: ['a[0->null]', 'b[1->null]']
        })
      )
    });

    it('Should throw when given invalid collection!', () => {
      expect(() => differ.diff('invalid')).toThrowError('Error trying to diff \'"invalid"\'. Only arrays and iterables are allowed');
    });

  });

  describe('trackBy function by id.', () => {

    let differ: DefaultQueuexIterableDiffer<any>;
    const trackByItemId = (_: number, item: any) => item.id;
    const buildItemList = (list: string[]) => list.map((val) => new ItemWithId(val));

    beforeEach(() => {
      differ = new DefaultQueuexIterableDiffer(trackByItemId)
    });

    it('should treat the collection as dirty if identity changes.', () => {
      differ.diff(buildItemList(['a']));
      expect(differ.diff(buildItemList(['a']))).toBe(differ);
    });

    it('should treat seen records as identity changes, not additions.', () => {
      let list = buildItemList(['a', 'b', 'c']);
      differ.diff(list);
      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: [`{id: a}[null->0]`, `{id: b}[null->1]`, `{id: c}[null->2]`],
          additions: [`{id: a}[null->0]`, `{id: b}[null->1]`, `{id: c}[null->2]`],
        })
      )

      list = buildItemList(['a', 'b', 'c']);
      differ.diff(list);

      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: [`{id: a}`, `{id: b}`, `{id: c}`],
          identityChanges: [`{id: a}`, `{id: b}`, `{id: c}`],
          noops: [`{id: a}`, `{id: b}`, `{id: c}`]
        }),
      );
    });

    it('should have updated properties in identity change collection.', () => {
      let list = [new ComplexItem('a', 'blue'), new ComplexItem('b', 'yellow')];
      differ.diff(list);

      list = [new ComplexItem('a', 'orange'), new ComplexItem('b', 'red')];
      differ.diff(list);
      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: [`{id: a, color: orange}`, `{id: b, color: red}`],
          identityChanges: [`{id: a, color: orange}`, `{id: b, color: red}`],
          noops: [`{id: a, color: orange}`, `{id: b, color: red}`],
        })
      )
    });

    it('Should track moves normally', () => {
      let list = buildItemList(['a', 'b', 'c']);
      differ.diff(list);

      list = buildItemList(['b', 'a', 'c']);
      differ.diff(list);
      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: ['{id: b}[1->0]', '{id: a}[0->1]', '{id: c}'],
          moves: ['{id: b}[1->0]'],
          identityChanges: ['{id: b}[1->0]', '{id: a}[0->1]', '{id: c}'],
          noops: ['{id: a}[0->1]', '{id: c}']
        })
      );
    });

    it('Should track duplicate reinsertion normally', () => {
      let list = buildItemList(['a', 'a']);
      differ.diff(list);

      list = buildItemList(['b', 'a', 'a']);
      differ.diff(list);
      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: ['{id: b}[null->0]', '{id: a}[0->1]', '{id: a}[1->2]'],
          additions: ['{id: b}[null->0]'],
          identityChanges: ['{id: a}[0->1]', '{id: a}[1->2]'],
          noops: ['{id: a}[0->1]', '{id: a}[1->2]']
        })
      )
    });

    it('Should keep the order of the duplicates.', () => {
      const list1 = [
        new ComplexItem('a', 'blue'),
        new ComplexItem('b', 'yellow'),
        new ComplexItem('c', 'orange'),
        new ComplexItem('a', 'red'),
      ];
      differ.diff(list1);

      const list2 = [
        new ComplexItem('b', 'yellow'),
        new ComplexItem('a', 'blue'),
        new ComplexItem('c', 'orange'),
        new ComplexItem('a', 'red'),
      ];
      differ.diff(list2);

      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: ['{id: b, color: yellow}[1->0]', '{id: a, color: blue}[0->1]', '{id: c, color: orange}', '{id: a, color: red}'],
          moves: ['{id: b, color: yellow}[1->0]'],
          noops: ['{id: a, color: blue}[0->1]', '{id: c, color: orange}', '{id: a, color: red}'],
          identityChanges: ['{id: b, color: yellow}[1->0]', '{id: a, color: blue}[0->1]', '{id: c, color: orange}', '{id: a, color: red}']
        })
      );
    });

    it('Should not have identity changed', () => {
      const list1 = [
        new ComplexItem('a', 'blue'),
        new ComplexItem('b', 'yellow'),
        new ComplexItem('c', 'orange'),
        new ComplexItem('a', 'red'),
      ];
      differ.diff(list1);

      const list2 = [list1[1], list1[0], list1[2], list1[3]];
      differ.diff(list2);

      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection: ['{id: b, color: yellow}[1->0]', '{id: a, color: blue}[0->1]', '{id: c, color: orange}', '{id: a, color: red}'],
          moves: ['{id: b, color: yellow}[1->0]'],
          noops: ['{id: a, color: blue}[0->1]', '{id: c, color: orange}', '{id: a, color: red}'],
        })
      );
    });

    it('Should track removals normally.', () => {
      const list = buildItemList(['a', 'b', 'c']);
      differ.diff(list);

      list.splice(2, 1);
      differ.diff(list);

      expect(iterableDifferToString(differ)).toEqual(
        iterableChangesAsString({
          collection:['{id: a}', '{id: b}'],
          removals: ['{id: c}[2->null]'],
          noops: ['{id: a}', '{id: b}']
        })
      );
    });

    describe('TrackBy function by index', () => {
      let differ: DefaultQueuexIterableDiffer<any>;
      const trackByIndex = (index: number) => index

      beforeEach(() => {
        differ = new DefaultQueuexIterableDiffer(trackByIndex);
      });

      it('Should track removals normally', () => {
        differ.diff(['a', 'b', 'c', 'd']);
        differ.diff(['e', 'f', 'g', 'h']);
        differ.diff(['e', 'f', 'h']);

        expect(iterableDifferToString(differ)).toEqual(
          iterableChangesAsString({
            collection: ['e', 'f', 'h'],
            removals: ['h[3->null]'],
            identityChanges: ['h'],
            noops: ['e', 'f', 'h']
          }),
        );
      })
    });
  });
});
