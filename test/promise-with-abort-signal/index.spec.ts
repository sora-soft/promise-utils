import {BeAbleToAbort, PromiseWithAbortSignal} from '../../src/index.js';
import * as ava from 'ava';
import delay from 'delay';
const test = ava.default;

test('PromiseWithAbortSignal resolve as promise', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  void new PromiseWithAbortSignal((resolve) => {
    resolve(result);
  }, {signal: ac.signal}).then((res) => {
    t.is(res, result);
  });
});

test('PromiseWithAbortSignal finally as promise', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  void new PromiseWithAbortSignal((resolve) => {
    resolve(result);
  }, {signal: ac.signal}).finally(() => {
    t.pass();
  });
});

test('PromiseWithAbortSignal use await', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  t.is(await new PromiseWithAbortSignal((resolve) => {
    resolve(result);
  }, {signal: ac.signal}), result);
});

test('PromiseWithAbortSignal reject as promise', async (t) => {
  const reason = 'reject as promise';
  const ac = new AbortController();
  await t.throwsAsync(new PromiseWithAbortSignal((resolve, reject) => {
    reject(new Error(reason));
  }, {signal: ac.signal}), {instanceOf: Error, message: reason});
});

test('PromiseWithAbortSignal finally as promise with reject', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject';
  const ac = new AbortController();
  const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(reason));
    }, 100);
  }, {signal: ac.signal});
  await t.throwsAsync(promiseWithAbortSignal.finally(() => {
    t.pass();
  }), {instanceOf: Error, message: reason});
});

test('PromiseWithAbortSignal finally as promise with reject and delay', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject and delay';
  const ac = new AbortController();
  const promiseWithAbortSignal = new PromiseWithAbortSignal(async (resolve, reject) => {
    await delay(100);
    reject(new Error(reason));
  }, {signal: ac.signal});
  await t.throwsAsync(promiseWithAbortSignal.finally(() => {
    t.pass();
  }), {instanceOf: Error, message: reason});
});

test('PromiseWithAbortSignal catch as promise', async (t) => {
  const reason = 'catch as promise';
  const ac = new AbortController();
  new PromiseWithAbortSignal((resolve, reject) => {
    reject(new Error(reason));
  }, {signal: ac.signal}).catch((err: Error) => {
    t.deepEqual(err, new Error(reason));
  });
});

test('PromiseWithAbortSignal with timeout', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  const res = await new PromiseWithAbortSignal((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {signal: ac.signal});
  t.is(res, result);
});

test('PromiseWithAbortSignal with abort', async (t) => {
  t.plan(3);
  const result = 'test';
  const ac = new AbortController();
  ac.signal.onabort = () => {
    t.pass();
  };
  const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {signal: ac.signal});
  await delay(10);
  ac.abort();
  await t.throwsAsync(promiseWithAbortSignal.then(() => {
    t.fail();
  }), {instanceOf: Error, message: 'This operation was aborted'});
  t.is(ac.signal.aborted, true);
});

test('PromiseWithAbortSignal with abort and onabort throw Error', async (t) => {
  t.plan(4);
  const result = 'test';
  const reason = 'with abort and onabort throw Error';
  const ac = new AbortController();
  const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }, {signal: ac.signal});
  ac.signal.addEventListener('abort', () => {
    t.pass();
  }, {once: true});
  ac.signal.addEventListener('abort', () => {
    t.throws(() => {
      throw new Error(reason);
    }, {instanceOf: Error, message: reason});
  }, {once: true});
  await delay(10);
  ac.abort();
  await t.throwsAsync(promiseWithAbortSignal.then(() => {
    t.fail();
  }), {instanceOf: Error, message: 'This operation was aborted'});
  t.is(ac.signal.aborted, true);
});

test('BeAbleToAbort resolve as promise', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  t.is(await BeAbleToAbort(new Promise((resolve) => {
    resolve(result);
  }), {signal: ac.signal}), result);
});

test('BeAbleToAbort use async', async (t) => {
  const result = 'test';
  const ac = new AbortController();
  t.is(await BeAbleToAbort((async () => {
    await delay(50);
    return result;
  }), {signal: ac.signal}), result);
});

test('BeAbleToAbort with abort', async (t) => {
  t.plan(4);
  const result = 'test';
  const reason = 'with abort';
  const ac = new AbortController();
  ac.signal.onabort = () => {
    t.pass();
  };
  const promiseWithAbortSignal = BeAbleToAbort(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), {signal: ac.signal});
  await delay(10);
  ac.abort(new Error(reason));
  await t.throwsAsync(promiseWithAbortSignal.then(() => {
    t.fail();
  }), {instanceOf: Error, message: reason});
  t.deepEqual(ac.signal.reason, new Error(reason));
  t.is(ac.signal.aborted, true);
});

test('BeAbleToAbort with abort and onabort throw Error', async (t) => {
  t.plan(5);
  const result = 'test';
  const reason = 'with abort and onabort throw Error';
  const ac = new AbortController();
  ac.signal.onabort = () => {
    t.deepEqual(ac.signal.reason, new Error(reason));
    t.pass();
  };
  const promiseWithAbortSignal = BeAbleToAbort(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), {signal: ac.signal});
  ac.signal.addEventListener('abort', () => {
    t.throws(() => {
      throw new Error(reason);
    }, {instanceOf: Error, message: reason});
  });
  await delay(10);
  ac.abort(new Error(reason));
  await t.throwsAsync(promiseWithAbortSignal.then(() => {
    t.fail();
  }), {instanceOf: Error, message: reason});
  t.is(ac.signal.aborted, true);
});

test('BeAbleToAbort with abort after resolve', async (t) => {
  t.plan(3);
  const result = 'test';
  const ac = new AbortController();
  const promiseWithAbortSignal = BeAbleToAbort(async () => {
    await delay(50);
    return result;
  }, {signal: ac.signal});
  void promiseWithAbortSignal.then(async (res) => {
    t.is(res, result);
    await delay(50);
    return res;
  }).then(async (res) => {
    t.is(res, result);
  }).catch(() => {
    t.fail();
  });
  await delay(60);
  ac.abort();
  t.is(ac.signal.aborted, true);
  await delay(50);
});

test('BeAbleToAbort routine use', async (t) => {
  t.plan(5);
  const result = 'test';
  const result2 = 'test2';
  const reason = 'routine use';
  let ac = new AbortController();
  setTimeout(() => {
    ac.abort(new Error(reason));
  }, 50);
  ac.signal.onabort = () => {
    t.deepEqual(ac.signal.reason, new Error(reason));
  };
  let res = await BeAbleToAbort(async () => {
    await delay(20);
    return result;
  }, {signal: ac.signal});
  t.is(res, result);
  await delay(40);

  ac = new AbortController();
  setTimeout(() => {
    ac.abort(new Error(reason));
  }, 20);
  ac.signal.onabort = () => {
    t.deepEqual(ac.signal.reason, new Error(reason));
  };
  res = await BeAbleToAbort(async () => {
    await delay(50);
    return result;
  }, {signal: ac.signal}).then((r)=>{
    t.fail();
    return r;
  }).catch((e) => {
    t.deepEqual(e, new Error(reason));
    return result2;
  });
  t.is(res, result2);
  await delay(50);
});
