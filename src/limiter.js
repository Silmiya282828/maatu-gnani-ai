// A small queue in front of each outside service. At most `max` calls run at
// once; the rest wait their turn instead of all hitting the API together and
// getting rate-limited. If the line gets too long we refuse new work early
// (backpressure) rather than letting memory and wait times grow forever.
export function createLimiter(name, max, maxQueue) {
  let active = 0;
  const waiting = [];

  function next() {
    if (active >= max || waiting.length === 0) return;
    active++;
    const { task, resolve, reject } = waiting.shift();
    task()
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  }

  function run(task) {
    if (waiting.length >= maxQueue) {
      return Promise.reject(new Error(`${name} queue is full (${maxQueue} waiting)`));
    }
    return new Promise((resolve, reject) => {
      waiting.push({ task, resolve, reject });
      next();
    });
  }

  run.stats = () => ({ name, active, waiting: waiting.length, max });
  return run;
}
