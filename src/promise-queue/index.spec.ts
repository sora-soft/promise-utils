import {PromiseQueue, TimeoutError} from '../index.js';
import * as ava from 'ava';
import delay from 'delay';
const test = ava.default;

test('TaskQueue addTask', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1});
  const res = await queue.add(async () => {
    await delay(10);
    return result;
  });
  t.is(res, result);
});

test('TaskQueue addTask with signal', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1});
  const ac = new AbortController();
  const res = await queue.add(async () => {
    await delay(10);
    return result;
  }, {
    signal: ac.signal,
  });
  t.is(res, result);
  ac.abort();
  await t.throwsAsync(queue.add(async () => {
    await delay(10);
    return result;
  }, {
    signal: ac.signal,
  }), {instanceOf: Error, message: 'This operation was aborted'});
});

test('TaskQueue addTask with signal and abort all', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 5});
  const ac1 = new AbortController();
  const ac2 = new AbortController();
  const promise1 = queue.add(async () => {
    await delay(10);
    return result;
  }, {
    signal: ac1.signal,
  });
  const promise2 = queue.add(async () => {
    await delay(10);
    return result;
  }, {
    signal: ac2.signal,
  });
  ac1.abort();
  ac2.abort();
  await t.throwsAsync(promise1, {instanceOf: Error, message: 'This operation was aborted'});
  await t.throwsAsync(promise2, {instanceOf: Error, message: 'This operation was aborted'});
  t.is(queue.size, 0);
  t.is(queue.pending, 0);
});

test('TaskQueue with timeout', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1, timeout: 20});
  const res = await queue.add(async () => {
    await delay(10);
    return result;
  });
  t.is(res, result);
  await t.throwsAsync(queue.add(async () => {
    await delay(30);
    return result;
  }), {instanceOf: TimeoutError, message: 'Promise timeout'});
});

test('TaskQueue with timeout and has changed', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1, timeout: 20});
  const res = await queue.add(async () => {
    await delay(10);
    return result;
  });
  t.is(res, result);
  await t.throwsAsync(queue.add(async () => {
    await delay(30);
    return result;
  }), {instanceOf: TimeoutError, message: 'Promise timeout'});
  queue.timeout = 50;
  t.is(await queue.add(async () => {
    await delay(30);
    return result;
  }), result);
});

test('TaskQueue with timeout addTask with signal', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1, timeout: 20});
  const ac = new AbortController();
  const res = await queue.add(async () => {
    await delay(10);
    return result;
  });
  t.is(res, result);
  await t.throwsAsync(queue.add(async () => {
    await delay(30);
    return result;
  }, {signal: ac.signal}), {instanceOf: TimeoutError, message: 'Promise timeout'});
  setTimeout(() => {
    ac.abort();
  }, 10);
  await t.throwsAsync(queue.add(async () => {
    await delay(30);
    return result;
  }, {signal: ac.signal}), {instanceOf: Error, message: 'This operation was aborted'});
});

test('TaskQueue addTask check size and pending', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1});
  const promise = queue.add(async () => {
    await delay(10);
    return result;
  });
  t.is(queue.size, 0);
  t.is(queue.pending, 1);
  t.is(await promise, result);
});

test('TaskQueue addTask with concurrency, check size and pending', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 2});
  const promise1 = queue.add(async () => {
    await delay(10);
    return 1;
  });
  const promise2 = queue.add(async () => {
    await delay(20);
    return 2;
  });
  const promise3 = queue.add(async () => {
    await delay(20);
    return 3;
  });
  const promise4 = queue.add(async () => {
    await delay(20);
    return 4;
  });
  const promise5 = queue.add(async () => {
    await delay(20);
    return 5;
  });
  t.is(queue.size, 3);
  t.is(queue.pending, 2);
  t.is(await promise1, 1);
  t.is(await promise2, 2);
  t.is(queue.size, 1);
  t.is(queue.pending, 2);
  t.is(await promise3, 3);
  t.is(queue.size, 0);
  t.is(queue.pending, 2);
  t.is(await promise4, 4);
  t.is(queue.size, 0);
  t.is(queue.pending, 1);
  t.is(await promise5, 5);
});

test('TaskQueue addTask with priority, check order', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 2});
  const res: number[] = [];
  const promise1 = queue.add(async () => {
    await delay(10);
    res.push(1);
  }, {priority: 10});
  const promise2 = queue.add(async () => {
    await delay(20);
    res.push(2);
  }, {priority: 10});
  const promise3 = queue.add(async () => {
    await delay(20);
    res.push(3);
  }, {priority: -1});
  const promise4 = queue.add(async () => {
    await delay(20);
    res.push(4);
  }, {priority: 0});
  const promise5 = queue.add(async () => {
    await delay(20);
    res.push(5);
  }, {priority: 5});
  await queue.onIdle();
  t.deepEqual(res, [1, 2, 5, 4, 3]);
});

test('TaskQueue addTask with concurrency 1, check run time', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 1});
  const times = [10, 20, 30, 40, 50];

  const start = Date.now();
  t.deepEqual(await Promise.all(times.map(async (time) => {
    return queue.add(async () => {
      await delay(time);
      return time;
    });
  })), times);
  const range = Date.now() - start;
  t.true(range >= 130 && range <= 230);
});

test('TaskQueue addTask with concurrency 5, check run time', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 5});
  const times = [20, 40, 60, 80, 100];

  const start = Date.now();
  t.deepEqual(await Promise.all(times.map(async (time) => {
    return queue.add(async () => {
      await delay(time);
      return time;
    });
  })), times);
  const range = Date.now() - start;
  t.true(range >= 80 && range <= 120);
});

test('TaskQueue update concurrency', async (t) => {
  const result = 'test';
  let concurrency = 5;
  const queue = new PromiseQueue({concurrency});
  let running = 0;
  for (const i of Array(100).keys()) {
    void queue.add(async () => {
      running++;
      t.true(running <= concurrency);
      t.true(queue.pending <= concurrency);
      await delay(10 + Math.random() * 20);
      running--;
      if (i % 12 === 0) {
        queue.concurrency = ++concurrency;
        t.is(queue.concurrency, concurrency);
      }
      if (i % 15 === 0) {
        queue.concurrency = --concurrency;
        t.is(queue.concurrency, concurrency);
      }
    });
  }
  await queue.onIdle();
  t.pass();
});

test('TaskQueue onSizeLessThan and onEmpty and onIdle', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 5});
  for (const i of Array(10).keys()) {
    void queue.add(async () => {
      await delay(20 + Math.random() * 10);
    });
  }
  await queue.onSizeLessThan(3);
  t.true(queue.size < 3);
  await queue.onEmpty();
  t.is(queue.size, 0);
  t.true(queue.pending > 0);
  await queue.onIdle();
  t.is(queue.size, 0);
  t.is(queue.pending, 0);
});

test('TaskQueue addAll', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 2});
  let promise = queue.addAll([
    async () => {
      await delay(20 + Math.random() * 10);
      return 1;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      throw new Error('test');
    },
  ]);
  t.is(queue.size, 0);
  t.is(queue.pending, 2);
  t.deepEqual(await promise, [{
    status: 'fulfilled',
    value: 1,
  }, {
    reason: new Error('test'),
    status: 'rejected',
  }]);
  queue.concurrency = 1;
  promise = queue.addAll([
    async () => {
      await delay(20 + Math.random() * 10);
      return 1;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 2;
    },
  ]);
  t.is(queue.size, 1);
  t.is(queue.pending, 1);
  t.deepEqual(await promise, [{
    status: 'fulfilled',
    value: 1,
  }, {
    status: 'fulfilled',
    value: 2,
  }]);
});

test('TaskQueue autoStart false', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 2, autoStart: false});
  const promise = queue.addAll([
    async () => {
      await delay(20 + Math.random() * 10);
      return 1;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 2;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 3;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 4;
    },
  ]);
  t.is(queue.size, 4);
  t.is(queue.pending, 0);
  t.is(queue.isPaused, true);
  queue.start();
  t.is(queue.size, 2);
  t.is(queue.pending, 2);
  t.is(queue.isPaused, false);
  t.deepEqual(await promise, [{
    status: 'fulfilled',
    value: 1,
  }, {
    status: 'fulfilled',
    value: 2,
  }, {
    status: 'fulfilled',
    value: 3,
  }, {
    status: 'fulfilled',
    value: 4,
  }]);
});

test('TaskQueue pause', async (t) => {
  const result = 'test';
  const queue = new PromiseQueue({concurrency: 2, autoStart: false});
  const promise = queue.addAll([
    async () => {
      await delay(20 + Math.random() * 10);
      return 1;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 2;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 3;
    },
    async () => {
      await delay(20 + Math.random() * 10);
      return 4;
    },
  ]);
  t.is(queue.size, 4);
  t.is(queue.pending, 0);
  t.is(queue.isPaused, true);
  queue.start();
  t.is(queue.size, 2);
  t.is(queue.pending, 2);
  t.is(queue.isPaused, false);
  void queue.add(async () => {
    await delay(20 + Math.random() * 10);
    return 5;
  });
  queue.pause();
  t.is(queue.size, 3);
  t.is(queue.pending, 2);
  t.is(queue.isPaused, true);
  await delay(50);
  t.is(queue.size, 3);
  t.is(queue.pending, 0);
  queue.start();
  t.is(queue.size, 1);
  t.is(queue.pending, 2);
  t.is(queue.isPaused, false);
  t.deepEqual(await promise, [{
    status: 'fulfilled',
    value: 1,
  }, {
    status: 'fulfilled',
    value: 2,
  }, {
    status: 'fulfilled',
    value: 3,
  }, {
    status: 'fulfilled',
    value: 4,
  }]);
});
