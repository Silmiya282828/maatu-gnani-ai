// Customers and riders repeat the same few phrases all day ("2 minutes",
// "I'm at the gate"). Translating and speaking each phrase once and reusing
// the result makes repeats instant and free.
//
// Least-recently-used: a Map remembers insertion order, so re-inserting on
// every read keeps hot phrases at the end and the oldest one at the front,
// which is the one we drop when the cache is full.
export class LruCache {
  constructor(maxEntries) {
    this.maxEntries = maxEntries;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value);
    }
  }
}
