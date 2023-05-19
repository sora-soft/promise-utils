import {CancelablePromise, CancelError} from '../../src/CancelablePromise/index.js';
import * as ava from 'ava';
const test = ava.default;

test('CancelablePromise resolve as promise', async (t) => {
  const result = 'test';
  void new CancelablePromise((resolve) => {
    resolve(result);
  }).then((res) => {
    t.is(res, result);
  });
});

test('CancelablePromise finally as promise', async (t) => {
  const result = 'test';
  void new CancelablePromise((resolve) => {
    resolve(result);
  }).finally(() => {
    t.pass();
  });
});

test('CancelablePromise use await', async (t) => {
  const result = 'test';
  t.is(await new CancelablePromise((resolve) => {
    resolve(result);
  }), result);
});

test('CancelablePromise reject as promise', async (t) => {
  const reason = 'reject as promise';
  await t.throwsAsync(new CancelablePromise((resolve, reject) => {
    reject(new Error(reason));
  }), {instanceOf: Error, message: reason});
});

test('CancelablePromise finally as promise with reject', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject';
  const cancelablePromise = new CancelablePromise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error(reason));
    }, 100);
  });

  await t.throwsAsync(cancelablePromise.finally(() => {
    t.pass();
  }), {instanceOf: Error, message: reason});
});

test('CancelablePromise catch as promise', async (t) => {
  const reason = 'catch as promise';
  new CancelablePromise((resolve, reject) => {
    reject(new Error(reason));
  }).catch((err: Error) => {
    t.deepEqual(err, new Error(reason));
  });
});

test('CancelablePromise with timeout', async (t) => {
  const result = 'test';
  const res = await new CancelablePromise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  });
  t.is(res, result);
});

test('CancelablePromise with cancel', async (t) => {
  t.plan(3);
  const result = 'test';
  const reson = 'with cancel';
  const cancelablePromise = new CancelablePromise((resolve, reject, onCancel) => {
    onCancel.cancelHandler(() => {
      t.pass();
    });
    setTimeout(() => {
      resolve(result);
    }, 100);
  });
  setTimeout(() => {
    cancelablePromise.cancel(reson);
  }, 10);
  await t.throwsAsync(cancelablePromise.then(() => {
    t.fail();
  }), {instanceOf: CancelError, message: reson});
  t.is(cancelablePromise.isCanceled, true);
});

test('CancelablePromise with cancel and not should reject', async (t) => {
  t.plan(4);
  const result = 'test';
  const cancelablePromise = new CancelablePromise((resolve, reject, onCancel) => {
    onCancel.cancelHandler(() => {
      t.pass();
    });
    onCancel.shouldReject = false;
    setTimeout(() => {
      resolve(result);
    }, 100);
  });
  setTimeout(() => {
    cancelablePromise.cancel();
  }, 10);
  await t.notThrowsAsync(cancelablePromise.then(() => {
    t.pass();
  }));
  t.is(cancelablePromise.isCanceled, true);
});
