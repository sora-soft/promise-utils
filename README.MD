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
提供PromiseWithAbortSignal和BeAbleToAbort，将一个普通的Promise对象转换为能够响应AbortController中止信号的Promise对象。PromiseWithAbortSignal\<ReturnType\>实现了PromiseLike\<ReturnType\>接口，因此可以使用 then/catch/finally等方法。
### new PromiseWithAbortSignal\<ReturnType\>(executor,options)
构造函数constructor(executor, options)接收两个参数，第一个参数是一个Promise执行器函数，第二个参数是一个包含中止信号的选项对象。
#### executor
Type: `Function`

Example: `(resolve,reject)=>{}`

新建普通Promise时使用的参数
#### options
##### signal
Type: `AbortSignal`

AbortController对象的signal属性

### BeAbleToAbort(promiseOrAsync,options)
options同PromiseWithAbortSignal
#### promiseOrAsync
Type: `Function`

Example: `new Promise((resolve,reject)=>{}) | async()=>{}`

一个需要包装的Promise或是Async函数

### 例子

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

可以使用BeAbleToAbort将PromiseLike或者Async函数封装成PromiseWithAbortSignal
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

```ts
import { BeAbleToAbort } from '@sora-soft/promise-utils';
import delay from 'delay'
const result = 'test1';
const result2 = 'test2';
const reason = 'reason';
const ac = new AbortController();
setTimeout(() => {
    ac.abort(new Error(reason));
}, 20);
ac.signal.onabort = () => {
    console.error(ac.signal.reason); // error: reason
};
const res = await BeAbleToAbort(async () => {
    await delay(50);
    return result;
}, { signal: ac.signal }).then((r) => {
    console.log('never log')
    return r;
}).catch((e) => {
    console.error(e); // error: reason
    return result2;
});
console.log(res) // test2
await delay(50);
```

其他更多的方式可以查看[PromiseWithAbortSignal的单元测试](src/promise-with-abort-signal/index.spec.ts)

## TimeoutPromise(超时即中断的Promise)
提供TimeoutPromise和BeAbleToTimeout，将一个普通的Promise对象转换为能够响应超时信号的Promise对象。TimeoutPromise\<ReturnType\>实现了PromiseLike\<ReturnType\>接口，因此可以使用 then/catch/finally等方法。

### new TimeoutPromise\<ReturnType\>(executor,options)
构造函数constructor(executor, options)接收两个参数，第一个参数是一个Promise执行器函数，第二个参数是一个包含超时时间和其他选项的对象。
#### executor
Type: `Function`

Example: `(resolve,reject)=>{}`

新建普通Promise时使用的参数
#### options
##### milliseconds
Type: `Number`

超时需要的毫秒数
##### message?
Type: `String`

超时时的报错信息，可选，不填时报错信息为Promise timeout
##### fallback?
Type: `Function`

Return: `ReturnType`

超时时返回默认值的函数，可选

### BeAbleToAbort(promiseOrAsync,options)
options同TimeoutPromise
#### promiseOrAsync
Type: `Function`

Example: `new Promise((resolve,reject)=>{}) | async()=>{}`

一个需要包装的Promise或是Async函数

### 函数

#### .clear()
清除超时的timeout

### 例子

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

TimeoutPromise提供.clear清除超时时间
```ts
import { BeAbleToTimeout } from '@sora-soft/promise-utils';
import delay from 'delay'
const result1 = 'result1';
const result2 = 'result2';
const start = Date.now();
const timeoutPromise = BeAbleToTimeout(async () => {
    await delay(100)
    return result1
}, {
    milliseconds: 50,
    fallback: () => result2
});
void timeoutPromise.then(async (res) => {
    console.log(Date.now() - start); // 135
    console.log(res); // result1
    return res;
});
timeoutPromise.clear();
console.log(await timeoutPromise); // result1
```

其他更多的方式可以查看[TimeoutPromise的单元测试](src/timeout-promise/index.spec.ts)

## PromiseQueue(Promise队列)
提供一个队列同时运行多个任务，任务可以是Promise或是Async函数，当达到最大同时运行数量后加入的任务等待先加入的任务运行完毕后再运行，提供onEmpty和onIdle帮助开发者在该队列处于未达到最大同时运行数量或是所有任务均已完成时进行其他操作，继承了EventEmitter，因此也可以自行处理事件。

### new PromiseQueue(options?)
构造函数constructor(options)接收一个可选的参数options，用于配置队列的并发数量、自动启动、超时等选项。构造函数创建一个新的PromiseQueue对象，并在内部维护一个队列和一个计数器来管理队列中的Promise。

#### options?
##### concurrency?
Type: `Number`

Default: `Number.POSITIVE_INFINITY`

最大同时运行数量
##### autoStart?
Type: `Boolean`

Default: `true`

是否自动运行
##### timeout?
Type: `Number`

如果设置了timeout，每一个加入的Promise都会变成TimeoutPromise

### 函数

#### .add(promiseOrAsync, addOptions?)

##### promiseOrAsync
Type: `Function`

Example: `new Promise((resolve,reject)=>{}) | async()=>{}`

一个Promise或是Async函数

##### addOptions?

###### signal?
Type: `AbortSignal`

AbortController对象的signal属性，如果有，则将该传入的Promise变成PromiseWithAbortSignal

###### priority?
Type: `Number`

优先级，值高的会优先进入运行

#### .addAll(promiseOrAsyncs,addOptions?)
promiseOrAsyncs为add的第一个参数promiseOrAsync的数组类型,addOptions同add的addOptions

#### .start()
如果queue暂停或是没有自动运行，可以调用该函数开始队列

#### .pause()
如果queue在运行，可以调用该函数暂停

#### .clear()
清空等待中的数组

#### .onEmpty()
返回一个Promise，当队列运行中的有空位时该Promise会调用.then

#### .onSizeLessThan(limit)

##### limit
Type: `Number`

如果等待中的任务数量少于limit则返回的Promise会调用.then

#### .onIdle()
返回一个Promise，当没有任务在运行时该Promise会调用.then

#### concurrency
当前最大并行运行数量，可以动态设置

#### size
正在等待的数量

#### pending
当前正在运行的数量

#### isPaused
是否暂停中

### 例子
add或addAll本身返回添加的任务的返回值
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

动态变更concurrency
```ts
import { PromiseQueue } from '@sora-soft/promise-utils';
import delay from 'delay'
let concurrency = 5;
const queue = new PromiseQueue({ concurrency });
let running = 0;
for (const i of Array(100).keys()) {
    void queue.add(async () => {
        running++;
        console.log(`running:${running} pending:${queue.pending} concurrency:${concurrency}`)
        if (queue.concurrency < queue.pending) {
            throw new Error('never happen')
        }
        await delay(10 + Math.random() * 20);
        running--;
        if (i % 12 === 0) {
            queue.concurrency = ++concurrency;
        }
        if (i % 15 === 0) {
            queue.concurrency = --concurrency;
        }
    });
}
await queue.onIdle();
```

其他更多的方式可以查看[PromiseQueue的单元测试](src/promise-queue/index.spec.ts)

## DebouncePromise(防抖的Promise)
提供DebouncePromise用于将一个函数转换为具有防抖效果的Promise，即在一定时间内，多次调用函数只会执行一次，在等待时间内，如果有新的调用，则重置等待时间，并且只会执行最后一次调用。这个函数的作用是可以用来优化一些需要频繁触发的函数。

### DebouncePromise(func,options)
函数接受两个参数
#### func
Type: `Function`

Example: `()=>new Promise((resolve,reject)=>{}) | async()=>{}`

要转换的函数，该函数必须返回一个 Promise 类型的对象或一个普通的值。如果该函数是异步函数，则必须返回一个 Promise 类型的对象。
#### options
一个对象，包含了milliseconds
##### milliseconds
Type: `Number`

防抖间隔的时间milliseconds，以毫秒为单位。

### 例子

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

### 错误处理

`DebouncePromise` 的所有调用者共享同一执行结果。如果被包装的函数抛出错误或返回 rejected promise，所有等待中的调用者都会收到相同的错误。

```ts
import { DebouncePromise } from '@sora-soft/promise-utils';

const fetchWithRetry = DebouncePromise(async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}, { milliseconds: 100 });

// 正确的错误处理方式
try {
  const data = await fetchWithRetry('/api/data');
  console.log(data);
} catch (error) {
  console.error('请求失败:', error);
  // 所有并发调用都会收到相同的错误
}
```

**重要提示**: 
- 如果第一个执行的请求失败，所有等待中的调用都会收到相同的错误
- 建议在被包装函数内部实现错误恢复逻辑（如重试、降级等）
- 对于需要独立错误处理的场景，考虑使用 `PromiseQueue` 代替

其他更多的方式可以查看[DebouncePromise的单元测试](src/debounce-promise/index.spec.ts)
## RetryPromise(自动重试的Promise)
提供RetryPromise将传入的函数变为可自动重试的Promise，函数返回一个新的Promise，与原始函数具有相同的参数和返回值类型。当新函数被调用时，它会在发生错误时自动进行重试，如果超过了最大重试次数则会抛出RetryError异常。RetryController是RetryPromise函数内部使用的重试控制器，它负责控制重试的次数、时间间隔等。提供了retry、try、reset、stop、errors、retryCount和mainError等方法和属性，用于控制和监控重试的过程和状态。
### RetryPromise(func,options)

#### func
Type: `Function`

Example: `()=>new Promise((resolve,reject)=>{}) | async()=>{}`

要转换的函数，该函数必须返回一个 Promise 类型的对象或一个普通的值。如果该函数是异步函数，则必须返回一个 Promise 类型的对象。

#### options?

##### maxRetryCount
Type: `Number`

Default: `10`

最大重试次数
##### minTimeInterval
Type: `Number`

Default: `1000`

最小时间间隔
##### maxTimeInterval
Type: `Number`

Default: `Number.POSITIVE_INFINITY`

最大时间间隔
##### maxRetryTime
Type: `Number`

Default: `Number.POSITIVE_INFINITY`

最大重试时间
##### incrementIntervalFactor
Type: `Number`

Default: `2`

时间间隔递进系数
##### incrementIntervalRandomize
Type: `Boolean`

Default: `false`

时间间隔是否需要加入随机
##### onError?
Type: `Function`

Example: `(error,currentRetryCount,nextTimeInterval)=>{}`

###### error
Type: `Error`

报错

###### currentRetryCount
Type: `Number`

当前重试次数

###### nextTimeInterval
Type: `Number`

下次重试间隔

出错时的额外处理
##### getTimeout?
Type: `Function`

Example: `(currentRetryCount)=>{return 1000}`

###### currentRetryCount
Type: `Number`

当前重试次数

传入已重试次数，返回下次时间间隔，替代minTimeInterval、maxTimeInterval、incrementIntervalFactor、incrementIntervalRandomize对于重试时间间隔的作用
##### signal?
Type: `AbortSignal`

AbortController对象的signal属性，可使当前的RetryPromise变成PromiseWithAbortSignal

### new RetryController(options)

#### options
同RetryPromise的options，少了signal
### 例子
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

直接使用RetryController，一般情况下不推荐，可以用RetryPromise解决问题就用RetryPromise
```ts
import { RetryController } from '@sora-soft/promise-utils';
import delay from 'delay'
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
await delay(5000)
console.log(i) // 5
```

其他更多的方式可以查看[RetryPromise的单元测试](src/retry-promise/index.spec.ts)
## CancelablePromise(可取消的Promise)
可以查看[CancelablePromise的单元测试](src/cancelable-promise/index.spec.ts)

建议使用[PromiseWithAbortSignal(可中断的Promise)](#promisewithabortsignal可中断的promise)
