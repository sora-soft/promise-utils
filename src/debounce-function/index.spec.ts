import {DebounceFunction} from '../index.js';
import * as ava from 'ava';
import delay from 'delay';
const test = ava.default;

test('DebounceFunction once call', async t => {
  const result = 'test';
  let func = DebounceFunction(async (value) => {
    return value;
  }, {milliseconds: 100});
  t.is(await func(result), result);
  func = DebounceFunction((value) => {
    return value;
  }, {milliseconds: 100});
  t.is(await func(result), result);
});

test('DebounceFunction delay for second call', async (t) => {
  const result = 'test';
  const start = Date.now();
  const func = DebounceFunction(() => result, {milliseconds: 100});
  void func().then((res) => {
    t.is(res, result);
    t.true(Date.now() - start >= 150);
  });
  await delay(50);
  void func().then((res) => {
    t.is(res, result);
  });
  await delay(150);
});

test('DebounceFunction multiple calls', async t => {
  const result = 'test';
  let count = 0;
  const start = Date.now();

  const func = DebounceFunction(async value => {
    count++;
    await delay(50);
    return value;
  }, {milliseconds: 100});

  const results = await Promise.all([1, 2, 3, 4, 5].map(value => func(value)));

  t.deepEqual(results, [5, 5, 5, 5, 5]);
  t.is(count, 1);
  t.true(Date.now() - start > 100 && Date.now() - start < 200);

  await delay(200);
  t.is(await func(6), 6);
});

test('DebounceFunction takes longer than wait', async t => {
  const result = 'test';
  let count = 0;

  const func = DebounceFunction(async value => {
    count++;
    await delay(100);
    return value;
  }, {milliseconds: 50});

  const setOne = [1, 2, 3];
  const setTwo = [4, 5, 6];

  const promiseSetOne = setOne.map(value => func(value));
  await delay(55);
  const promiseSetTwo = setTwo.map(value => func(value));

  const results = await Promise.all([...promiseSetOne, ...promiseSetTwo]);

  t.deepEqual(results, [3, 3, 3, 6, 6, 6]);
  t.is(count, 2);
});
