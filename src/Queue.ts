export class Queue<T> {
  items: T[] = [];
  busy = false;

  get length(): number {
    return this.items.length;
  }

  add(item: T) {
    this.items.push(item);
  }

  receive(): T | undefined {
    return this.items.shift();
  }

}