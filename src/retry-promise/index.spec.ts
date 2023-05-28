import delay from 'delay';
import {RetryController, RetryError, RetryPromise} from '../index.js';
import * as ava from 'ava';
const test = ava.default;

test('RetryPromise call', async (t) => {
  const result = 'test';
  let i = 0;
  const now = Date.now();
  const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    onError: (error) => {
      t.is(error, errors[i - 1]);
    },
  });
  t.is(await func(result), result);
  t.true(Date.now() - now >= 1000 + 2000 + 4000);
  t.is(i, 3);
});

test('RetryPromise throw error', async (t) => {
  const result = 'test';
  let i = 0;
  let c = 0;
  const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise(async (value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    onError: (error, currentRetryCount) => {
      c = currentRetryCount;
    },
    maxRetryCount: 1,
  });
  await t.throwsAsync(func(result), {
    instanceOf: Error, message: 'test2',
  });
  t.is(c, 1);
});

test('RetryPromise with abort', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  let i = 0;
  const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise(async (value) => {
    if (i === 1) {
      ac.abort();
      return;
    }
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    signal: ac.signal,
  });
  await t.throwsAsync(func(result), {
    instanceOf: Error, message: 'This operation was aborted',
  });
  t.is(i, 1);
  t.is(ac.signal.aborted, true);
});

test('RetryPromise with abort outside', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  let i = 0;
  const now = Date.now();
  const errors = Array(5).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise(async (value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    signal: ac.signal,
  });
  void delay(5000).then(() => {
    ac.abort();
  });
  await t.throwsAsync(func(result), {
    instanceOf: Error, message: 'This operation was aborted',
  });
  t.true(Date.now() - now >= 5000 && Date.now() - now < 5500);
  t.is(i, 3);
  t.is(ac.signal.aborted, true);
});

test('RetryPromise multiple calls', async (t) => {
  const result = 'test';
  let i = 0;
  let c = 0;
  const now = Date.now();
  const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    onError: (error, currentRetryCount) => {
      c = currentRetryCount;
    },
  });
  t.is(await func(result), result);
  t.is(c, 2);
  c = 0;
  t.is(await func(result), result);
  t.is(c, 0);
  t.true(Date.now() - now >= 1000 + 2000 + 4000);
});

test('RetryPromise time interval', async (t) => {
  const result = 'test';
  let i = 0;
  const now = Date.now();
  const errors = Array(5).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    minTimeInterval: 100,
    incrementIntervalFactor: 1,
  });
  t.is(await func(result), result);
  t.true(Date.now() - now >= 500 && Date.now() - now < 600);
});

test('RetryPromise time interval max and randomize', async (t) => {
  const result = 'test';
  let i = 0;
  const now = Date.now();
  let time = 0;
  const errors = Array(5).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    minTimeInterval: 100,
    maxTimeInterval: 500,
    incrementIntervalFactor: 2,
    incrementIntervalRandomize: true,
    onError: (error, currentRetryCount, nextTimeInterval) => {
      t.is(error, errors[i - 1]);
      t.is(currentRetryCount, i - 1);
      t.true(nextTimeInterval >= 100 && nextTimeInterval <= 500);
      time += nextTimeInterval;
    },
  });
  t.is(await func(result), result);
  t.true(Date.now() - now >= time && Date.now() - now < time + 100);
});

test('RetryPromise with getTimeout', async (t) => {
  const result = 'test';
  let i = 0;
  const now = Date.now();
  const errors = Array(5).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    getTimeout: () => {
      return 100;
    },
    onError: (error, currentRetryCount, nextTimeInterval) => {
      t.is(error, errors[i - 1]);
      t.is(currentRetryCount, i - 1);
      t.true(nextTimeInterval === 100);
    },
  });
  t.is(await func(result), result);
  t.true(Date.now() - now >= 500 && Date.now() - now < 600);
});

test('RetryPromise with maxRetryTime', async (t) => {
  const result = 'test';
  let i = 0;
  const now = Date.now();
  const errors = Array(5).fill(1).map((v, index) => {
    return new Error('test');
  });
  const func = RetryPromise((value) => {
    if (errors[i]) {
      throw errors[i++];
    }
    return value;
  }, {
    getTimeout: () => {
      return 100;
    },
    maxRetryTime: 300,
  });
  await t.throwsAsync(func(result), {
    instanceOf: RetryError, message: 'Retry timeout',
  });
  t.true(Date.now() - now >= 300 && Date.now() - now < 400);
});

test('RetryController', async (t) => {
  const result = 'test';
  const controller = new RetryController({
    maxRetryCount: 10,
    minTimeInterval: 500,
    maxTimeInterval: Number.POSITIVE_INFINITY,
    maxRetryTime: Number.POSITIVE_INFINITY,
    incrementIntervalFactor: 1,
    incrementIntervalRandomize: false,
    onError: () => { },
  });
  let i = 0;
  controller.try(async (retryCount) => {
    controller.retry(retryCount < 5 ? new Error('test') : null);
    i = retryCount;
  });
  await delay(600);
  t.is(i, 1);
  await delay(600);
  t.is(i, 2);
  await delay(600);
  t.is(i, 3);
  await delay(3000);
  t.is(i, 5);
});
