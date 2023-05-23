import {BeCancelable, CancelError, CancelablePromise} from '../index.js';
import * as ava from 'ava';
import delay from 'delay';
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

test('CancelablePromise finally as promise with reject and delay', async (t) => {
  t.plan(2);
  const reason = 'finally as promise with reject and delay';
  const cancelablePromise = new CancelablePromise(async (resolve, reject) => {
    await delay(100);
    reject(new Error(reason));
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
  const reason = 'with cancel';
  const cancelablePromise = new CancelablePromise((resolve, reject, onCancel) => {
    onCancel.cancelHandler(() => {
      t.pass();
    });
    setTimeout(() => {
      resolve(result);
    }, 100);
  });
  setTimeout(() => {
    cancelablePromise.cancel(reason);
  }, 10);
  await t.throwsAsync(cancelablePromise.then(() => {
    t.fail();
  }), {instanceOf: CancelError, message: reason});
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

test('CancelablePromise with cancel and onCancel throw Error', async (t) => {
  t.plan(4);
  const result = 'test';
  const reason = 'with cancel and onCancel throw Error';
  const cancelablePromise = new CancelablePromise((resolve, reject, onCancel) => {
    onCancel.cancelHandler(() => {
      t.pass();
    });
    onCancel.cancelHandler(() => {
      throw new Error(reason);
    });
    setTimeout(() => {
      resolve(result);
    }, 100);
  });
  setTimeout(() => {
    t.throws(() => { cancelablePromise.cancel(); }, {instanceOf: Error, message: reason});
  }, 10);
  await t.throwsAsync(cancelablePromise.then(() => {
    t.fail();
  }), {instanceOf: CancelError, message: 'Promise was canceled'});
  t.is(cancelablePromise.isCanceled, true);
});

test('BeCancelable resolve as promise', async (t) => {
  const result = 'test';
  t.is(await BeCancelable(new Promise((resolve) => {
    resolve(result);
  })), result);
});

test('BeCancelable use async', async (t) => {
  const result = 'test';
  t.is(await BeCancelable((async () => {
    await delay(50);
    return result;
  })), result);
});

test('BeCancelable with cancel', async (t) => {
  t.plan(3);
  const result = 'test';
  const reason = 'with cancel';
  const cancelablePromise = BeCancelable(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), () => {
    t.pass();
  });
  setTimeout(() => {
    cancelablePromise.cancel(reason);
  }, 10);
  await t.throwsAsync(cancelablePromise.then(() => {
    t.fail();
  }), {instanceOf: CancelError, message: reason});
  t.is(cancelablePromise.isCanceled, true);
});

test('BeCancelable with cancel and not should reject', async (t) => {
  t.plan(4);
  const result = 'test';
  const cancelablePromise = BeCancelable(new Promise((resolve,) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), () => {
    t.pass();
  }, false);
  setTimeout(() => {
    cancelablePromise.cancel();
  }, 10);
  await t.notThrowsAsync(cancelablePromise.then(() => {
    t.pass();
  }));
  t.is(cancelablePromise.isCanceled, true);
});

test('BeCancelable with cancel and onCancel throw Error', async (t) => {
  t.plan(4);
  const result = 'test';
  const reason = 'with cancel and onCancel throw Error';
  const cancelablePromise = BeCancelable(new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 100);
  }), () => {
    t.pass();
  });
  cancelablePromise.addCancelHandler(() => {
    throw new Error(reason);
  });
  setTimeout(() => {
    t.throws(() => { cancelablePromise.cancel(); }, {instanceOf: Error, message: reason});
  }, 10);
  await t.throwsAsync(cancelablePromise.then(() => {
    t.fail();
  }), {instanceOf: CancelError, message: 'Promise was canceled'});
  t.is(cancelablePromise.isCanceled, true);
});
