# 简介
- 提供各种Promise的相关工具类
- 使用ES模块，package.json需要配置"type": "module"
- AbortController为NodeJS v15.x新特性
- 推荐使用typescript

# 安装
npm install @sora-soft/promise-utils

# 教程

  - [PromiseWithAbortSignal(可中断的Promise)](#promisewithabortsignal可中断的promise)
  - [TimeoutPromise(超时即中断的Promise)](#timeoutpromise超时即中断的promise)
  - [PromiseQueue(Promise队列)](#promisequeuepromise队列)
  - [DebouncePromise(防抖的Promise)](#debouncepromise防抖的promise)
  - [RetryPromise(自动重试的Promise)](#retrypromise自动重试的promise)
  - [CancelablePromise(可取消的Promise)](#cancelablepromise可取消的promise)

## PromiseWithAbortSignal(可中断的Promise)
用和创建Promise相同的方式传入PromiseExecutor并在附加选项中传入AbortController的signal

当调用这个AbortController的abort()时，Promise会reject
```ts
import { PromiseWithAbortSignal } from '@sora-soft/promise-utils';
const ac = new AbortController();
const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve) => {
    setTimeout(() => {
        resolve(result);
    }, 100);
}, { signal: ac.signal });
ac.abort();
promiseWithAbortSignal.catch((e) => {
    console.error(e) // DOMException [AbortError]: This operation was aborted
})
```

PromiseWithAbortSignal实现了PromiseLike，支持await
```ts
import { PromiseWithAbortSignal } from '@sora-soft/promise-utils';
const ac = new AbortController();
const result = await new PromiseWithAbortSignal((resolve) => {
    resolve('result');
}, { signal: ac.signal });
console.log(result); // result
```

也可以使用BeAbleToAbort将PromiseLike或者Async函数封装成PromiseWithAbortSignal
```ts
import { BeAbleToAbort } from '@sora-soft/promise-utils';
import delay from 'delay';
const ac = new AbortController();
const promiseWithAbortSignal = BeAbleToAbort(async () => {
    await delay(100);
    return 'result';
}, { signal: ac.signal });
ac.abort();
promiseWithAbortSignal.catch((e) => {
    console.error(e); // DOMException [AbortError]: This operation was aborted
});
```

其他更多的方式可以查看[PromiseWithAbortSignal的单元测试](src/promise-with-abort-signal/index.spec.ts)

## TimeoutPromise(超时即中断的Promise)
用和创建Promise相同的方式传入PromiseExecutor并在附加选项中传入超时毫秒数milliseconds

当调用这个TimeoutPromise超时时，Promise会reject
```ts
import { TimeoutPromise } from '@sora-soft/promise-utils';
const result = 'test';
new TimeoutPromise((resolve) => {
    setTimeout(() => {
        resolve(result);
    }, 100);
}, { milliseconds: 50 }).catch((e) => {
    console.error(e); // TimeoutError: Promise timeout
});
```

定义报错message
```ts
import { TimeoutPromise } from '@sora-soft/promise-utils';
const result = 'test';
new TimeoutPromise((resolve) => {
    setTimeout(() => {
        resolve(result);
    }, 100);
}, { milliseconds: 50, message: 'custom error' }).catch((e) => {
    console.error(e); // TimeoutError: custom error
});
```

定义fallback，超时时不进行reject，而是调用fallback将结果返回
```ts
import { TimeoutPromise } from '@sora-soft/promise-utils';
const result = 'test';
new TimeoutPromise((resolve) => {
    setTimeout(() => {
        resolve(result);
    }, 100);
}, {
    milliseconds: 50,
    fallback: () => {
        return 'fallback';
    }
}).then((res) => {
    console.log(res); // fallback
})
```

也可以使用BeAbleToTimeout将PromiseLike或者Async函数封装成TimeoutPromise
```ts
import { BeAbleToTimeout } from '@sora-soft/promise-utils';
import delay from 'delay';
const result = 'test';
BeAbleToTimeout(async () => {
    return result;
}, {
    milliseconds: 50
}).then((res) => {
    console.log(res); // test
})
BeAbleToTimeout(async () => {
    await delay(100);
    return result;
}, {
    milliseconds: 50,
    fallback: () => {
        return 'fallback';
    }
}).then((res) => {
    console.log(res); // fallback
})
```

其他更多的方式可以查看[TimeoutPromise的单元测试](src/timeout-promise/index.spec.ts)

## PromiseQueue(Promise队列)
提供一个队列同时运行多个任务，任务可以是Promise或是Async函数，当达到最大同时运行数量后加入的任务等待先加入的任务运行完毕后再运行，提供onEmpty和onIdle帮助开发者在该队列处于未达到最大同时运行数量或是所有任务均已完成时进行其他操作

concurrency为最大同时运行数量，queue的pending为当前正在运行的数量，size为正在等待的数量，add或addAll本身返回添加的任务的返回值
```ts
import { PromiseQueue } from '@sora-soft/promise-utils';
import delay from 'delay';
const queue = new PromiseQueue({ concurrency: 2 });
const start = Date.now()
queue.addAll(new Array(10).fill(1).map((v, index) => {
    return async () => {
        await delay(1000);
        console.log(`index:${index} seconds:${Math.round((Date.now() - start) / 1000)} pending:${queue.pending} size:${queue.size}`);
        return index;
    }
})).then((result) => {
    console.log(result);
});
await queue.onIdle();
console.log('end');
// index:0 seconds:1 pending:2 size:8
// index:1 seconds:1 pending:2 size:7
// index:2 seconds:2 pending:2 size:6
// index:3 seconds:2 pending:2 size:5
// index:4 seconds:3 pending:2 size:4
// index:5 seconds:3 pending:2 size:3
// index:6 seconds:4 pending:2 size:2
// index:7 seconds:4 pending:2 size:1
// index:8 seconds:5 pending:2 size:0
// index:9 seconds:5 pending:1 size:0
// end
// [
//   0, 1, 2, 3, 4,
//   5, 6, 7, 8, 9
// ]
```

PromiseQueue还能传入autoStart和timeout，timeout会使添加的变成TimeoutPromise，在超时时reject，使得等待的任务提前运行，和未设置超时选项时产生的结果不同，添加任务时可以传入signal使添加的任务为PromiseWithAbortSignal，使得该任务可以在其他地方进行abort，传入priority可以调整传入任务的优先级，当一个任务结束后会运行等待任务中优先级最高的，否则就运行最先等待的
```ts
import { PromiseQueue } from '@sora-soft/promise-utils';
import delay from 'delay';
const queue = new PromiseQueue({ concurrency: 2, autoStart: true, timeout: 500, });
const start = Date.now()
queue.addAll(new Array(10).fill(1).map((v, index) => {
    return async () => {
        await delay(1000);
        console.log(`index:${index} seconds:${Math.round((Date.now() - start) / 1000)} pending:${queue.pending} size:${queue.size}`);
        return index;
    }
}), {
    signal: new AbortController().signal,
    priority: 1
}).catch(() => {
})
await queue.onIdle();
console.log('end');
// index:0 seconds:1 pending:2 size:6
// index:1 seconds:1 pending:2 size:6
// index:2 seconds:2 pending:2 size:4
// index:3 seconds:2 pending:2 size:4
// index:4 seconds:2 pending:2 size:2
// index:5 seconds:2 pending:2 size:2
// index:6 seconds:3 pending:2 size:0
// index:7 seconds:3 pending:2 size:0
// end
// index:8 seconds:3 pending:0 size:0
// index:9 seconds:3 pending:0 size:0
```

其他更多的方式可以查看[PromiseQueue的单元测试](src/promise-queue/index.spec.ts)

## DebouncePromise(防抖的Promise)
将传入的函数变为防抖的Promise，一段时间内调用多次只会运行最后一次，并将最后一次的返回值返回

传入需要运行的函数以及milliseconds，可使该函数在milliseconds毫秒内只运行一次
```ts
import { DebouncePromise } from '@sora-soft/promise-utils';
import delay from 'delay';
const start = Date.now();
const func = DebouncePromise((arg) => arg, { milliseconds: 100 });
void func(1).then((res) => {
    console.log(`result:${res} use:${Date.now() - start}`)
});
await delay(50);
void func(2).then((res) => {
    console.log(`result:${res} use:${Date.now() - start}`)
});
await delay(50);
void func(3).then((res) => {
    console.log(`result:${res} use:${Date.now() - start}`)
});
// result:3 use:229
// result:3 use:232
// result:3 use:233
```

支持传入Async函数，在milliseconds毫秒内调用多次只会运行最后一次
```ts
import { DebouncePromise } from '@sora-soft/promise-utils';
import delay from 'delay';
let count = 0;
const func = DebouncePromise(async value => {
    count++;
    await delay(50);
    return value;
}, { milliseconds: 100 });
console.log(await Promise.all([1, 2, 3, 4, 5].map(value => func(value)))); // [5, 5, 5, 5, 5]
console.log(count); // 1
```

其他更多的方式可以查看[DebouncePromise的单元测试](src/debounce-promise/index.spec.ts)
## RetryPromise(自动重试的Promise)
将传入的函数变为可自动重试的Promise

自动重试直到超出重试次数或是超时或是调用的函数不报错

maxRetryCount:最大重试次数，默认为10

minTimeInterval:最小时间间隔，默认为1000

maxTimeInterval:最大时间间隔，默认为Number.POSITIVE_INFINITY

maxRetryTime:最大重试时间，默认为Number.POSITIVE_INFINITY

incrementIntervalFactor:时间间隔递进系数，默认为2

incrementIntervalRandomize:时间间隔是否需要加入随机，默认为false

onError:出错时的额外处理

getTimeout:传入已重试次数，返回下次时间间隔，替代minTimeInterval、maxTimeInterval、incrementIntervalFactor、incrementIntervalRandomize对于重试时间间隔的作用

signal:可使当前的RetryPromise变成PromiseWithAbortSignal
```ts
import { RetryPromise } from '@sora-soft/promise-utils';
const result = 'test';
let i = 0;
const start = Date.now();
const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
});
const func = RetryPromise((value) => {
    if (errors[i]) {
        throw errors[i++];
    }
    return value;
}, {
    maxRetryCount: 10,
    minTimeInterval: 1000,
    maxTimeInterval: Number.POSITIVE_INFINITY,
    maxRetryTime: Number.POSITIVE_INFINITY,
    incrementIntervalFactor: 2,
    incrementIntervalRandomize: false,
    onError: (error) => {
        console.error(error)
    },
});
console.log(await func(result))
console.log(Date.now() - start)
console.log(i)
// Error: test1
// Error: test2
// Error: test3
// test
// 7029
// 3
```

当maxRetryCount为1时，只会重试1次，然后取出现次数最多或是最后的错误抛出
```ts
import { RetryPromise } from '@sora-soft/promise-utils'
const result = 'test';
let i = 0;
let c = 0;
const errors = Array(3).fill(1).map((v, index) => {
    return new Error(`test${index + 1}`);
}); // [Error: test1, Error: test2, Error: test3]
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
await func(result).catch((error) => {
    console.error(error) // Error: test2
})
console.log(c) // 1
```

使用signal进行中断
```ts
import { RetryPromise } from '@sora-soft/promise-utils'
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
await func(result).catch((error) => {
    console.error(error) // DOMException [AbortError]: This operation was aborted
})
```

默认时间间隔计算公式，currentRetryCount为当前重试次数，因此当incrementIntervalFactor为1且incrementIntervalRandomize为false时，时间间隔固定
```ts
const random = (incrementIntervalRandomize)
    ? (Math.random() + 1)
    : 1;
const nextTimeInterval = Math.min(
    Math.round(random * Math.max(minTimeInterval, 1)) * Math.pow(incrementIntervalFactor, currentRetryCount),
    maxTimeInterval,
);
return nextTimeInterval
```
```ts
import { RetryPromise } from '@sora-soft/promise-utils'
const result = 'test';
let i = 0;
const start = Date.now();
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
await func()
console.log(Date.now() - start); // 541
```

使用getTimeout
```ts
import { RetryPromise } from '@sora-soft/promise-utils'
const result = 'test';
let i = 0;
const start = Date.now();
const errors = Array(5).fill(1).map((v, index) => {
  return new Error(`test${index + 1}`);
});
const func = RetryPromise((value) => {
  if (errors[i]) {
    throw errors[i++];
  }
  return value;
}, {
  getTimeout: (currentRetryCount) => {
    return 300;
  }
});
await func(result)
console.log(Date.now() - start) // 1559
```

其他更多的方式可以查看[RetryPromise的单元测试](src/retry-promise/index.spec.ts)
## CancelablePromise(可取消的Promise)
可以查看[CancelablePromise的单元测试](src/cancelable-promise/index.spec.ts)

建议使用[PromiseWithAbortSignal(可中断的Promise)](#promisewithabortsignal可中断的promise)
