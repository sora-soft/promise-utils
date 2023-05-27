# 简介
提供各种Promise的相关工具类

# 安装
npm install @sora-soft/promise-utils

# 教程

- [PromiseWithAbortSignal(可中断的Promise)](#promisewithabortsignal可中断的promise)

## PromiseWithAbortSignal(可中断的Promise)
用和创建Promise相同的方式传入PromiseExecutor并在附加选项中传入AbortController的signal
当调用这个AbortController的abort()时，Promise会reject
```js
import {PromiseWithAbortSignal} from '@sora-soft/promise-utils';
const ac = new AbortController();
const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve) => {
  setTimeout(() => {
    resolve(result);
  }, 100);
}, {signal: ac.signal});
ac.abort();
promiseWithAbortSignal.catch((e)=>{
  console.error(e) // This operation was aborted
})
```

PromiseWithAbortSignal实现了PromiseLike，支持await
```js
import {PromiseWithAbortSignal} from '@sora-soft/promise-utils';
const ac = new AbortController();
const result = await new PromiseWithAbortSignal((resolve) => {
  resolve('result');
}, {signal: ac.signal});
console.log(result); // result
```

也可以使用BeAbleToAbort将PromiseLike或者Async函数封装成PromiseWithAbortSignal
```js
import {BeAbleToAbort} from './index.js';
import delay from 'delay';
const ac = new AbortController();
const promiseWithAbortSignal = BeAbleToAbort(async() => {
  await delay(100);
  return 'result';
}, {signal: ac.signal});
ac.abort();
promiseWithAbortSignal.catch((e)=>{
  console.error(e); // This operation was aborted
});
```

其他更多的方式可以查看[PromiseWithAbortSignal的单元测试](src/promise-with-abort-signal/index.spec.ts)
