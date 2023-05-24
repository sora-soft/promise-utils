import {BeAbleToTimeout, TimeoutError, TimeoutPromise} from '../index.js';
import * as ava from 'ava';
import delay from 'delay';
const test = ava.default;

test('TimeoutPromise resolve as promise', async (t) => {
  const result = 'test';
  await new TimeoutPromise((resolve, reject) => {
    setTimeout(() => {
      resolve(result);
    }, 50);
  }, {milliseconds: 100}).then((res) => {
    t.is(res, result);
  });
});

test('TimeoutPromise milliseconds error', async (t) => {
  const result = 'test';
  await t.throwsAsync(new TimeoutPromise((resolve, reject) => {
    setTimeout(() => {
      resolve(result);
    }, 50);
  }, {milliseconds: -1}), {instanceOf: TypeError, message: 'milliseconds error: -1'});
});

test('TimeoutPromise finally as promise', async (t) => {
  const result = 'test';
  await new TimeoutPromise((resolve, reject) => {
    setTimeout(() => {
      resolve(result);
    }, 50);
  }, {milliseconds: 100}).finally(() => {
    t.pass();
  });
});

test('TimeoutPromise reject as promise', async (t) => {
  const reason = 'reject as promise';
  await t.throwsAsync(new TimeoutPromise((resolve, reject) => {
    reject(new Error(reason));
  }, {milliseconds: 100}), {instanceOf: Error, message: reason});
});

test('TimeoutPromise finally as promise with reject', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject';
  const timeoutPromise = new TimeoutPromise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(reason));
    }, 50);
  }, {milliseconds: 100});
  await t.throwsAsync(timeoutPromise.finally(() => {
    t.pass();
  }), {instanceOf: Error, message: reason});
});

test('TimeoutPromise finally as promise with reject and delay', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject and delay';
  const timeoutPromise = new TimeoutPromise(async (resolve, reject) => {
    await delay(50);
    reject(new Error(reason));
  }, {milliseconds: 100});
  await t.throwsAsync(timeoutPromise.finally(() => {
    t.pass();
  }), {instanceOf: Error, message: reason});
});

test('TimeoutPromise catch as promise', async (t) => {
  const reason = 'catch as promise';
  new TimeoutPromise((resolve, reject) => {
    reject(new Error(reason));
  }, {milliseconds: 100}).catch((err: Error) => {
    t.deepEqual(err, new Error(reason));
  });
});

test('TimeoutPromise with timeout', async (t) => {
  t.plan(2);
  const result = 'test';
  await t.throwsAsync(new TimeoutPromise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {milliseconds: 50}), {instanceOf: TimeoutError, message: 'Promise timeout'});
  t.pass();
});

test('TimeoutPromise with timeout message', async (t) => {
  t.plan(2);
  const result = 'test';
  const reason = 'with timeout message';
  await t.throwsAsync(new TimeoutPromise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {milliseconds: 50, message: reason}), {instanceOf: TimeoutError, message: reason});
  t.pass();
});

test('TimeoutPromise with fallback', async (t) => {
  t.plan(3);
  const result = 'test';
  const result2 = 'test2';
  const now = Date.now();
  await new TimeoutPromise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 500);
  }, {
    milliseconds: 50,
    fallback: () => {
      return result2;
    },
  }).then(async (res) => {
    t.true(Date.now() - now < 100);
    t.is(res, result2);
  });
  t.pass();
});

test('TimeoutPromise with clear', async (t) => {
  t.plan(4);
  const result = 'test';
  const result2 = 'test2';
  const now = Date.now();
  const timeoutPromise = new TimeoutPromise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {
    milliseconds: 50,
    fallback: () => {
      return result2;
    },
  });
  void timeoutPromise.then(async (res) => {
    t.true(Date.now() - now > 90);
    t.is(res, result);
    return res;
  });
  timeoutPromise.clear();
  t.is(await timeoutPromise, result);
  t.pass();
});

test('BeAbleToTimeout resolve as promise', async (t) => {
  const result = 'test';
  t.is(await BeAbleToTimeout(new Promise((resolve) => {
    resolve(result);
  }), {milliseconds: 50}), result);
});

test('BeAbleToTimeout use async', async (t) => {
  const result = 'test';
  t.is(await BeAbleToTimeout((async () => {
    return result;
  }), {milliseconds: 50}), result);
});

test('BeAbleToTimeout with timeout', async (t) => {
  t.plan(4);
  const result = 'test';
  await t.throwsAsync(BeAbleToTimeout(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), {milliseconds: 50}), {instanceOf: TimeoutError, message: 'Promise timeout'});
  t.pass();
  await t.throwsAsync(BeAbleToTimeout((async () => {
    await delay(100);
    return result;
  }), {milliseconds: 50}), {instanceOf: TimeoutError, message: 'Promise timeout'});
  t.pass();
});

test('BeAbleToTimeout with fallback', async (t) => {
  t.plan(3);
  const result = 'test';
  const result2 = 'test2';
  const now = Date.now();
  await BeAbleToTimeout(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 500);
  }), {
    milliseconds: 50,
    fallback: () => {
      return result2;
    },
  }).then(async (res) => {
    t.true(Date.now() - now < 100);
    t.is(res, result2);
  });
  t.pass();
});

test('BeAbleToTimeout with clear', async (t) => {
  t.plan(4);
  const result = 'test';
  const result2 = 'test2';
  const now = Date.now();
  const timeoutPromise = BeAbleToTimeout(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), {
    milliseconds: 50,
    fallback: () => {
      return result2;
    },
  });
  void timeoutPromise.then(async (res) => {
    t.true(Date.now() - now > 90);
    t.is(res, result);
    return res;
  });
  timeoutPromise.clear();
  t.is(await timeoutPromise, result);
  t.pass();
});

test('BeAbleToTimeout routine use', async (t) => {
  t.plan(2);
  const result = 'test';
  const result2 = 'test2';
  const now = Date.now();
  const res = await BeAbleToTimeout(async () => {
    await delay(500);
    return result;
  }, {
    milliseconds: 50,
    fallback: () => {
      return result2;
    },
  });
  t.true(Date.now() - now < 100);
  t.is(res, result2);
});
