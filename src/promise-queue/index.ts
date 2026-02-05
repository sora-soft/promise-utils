import {EventEmitter} from 'eventemitter3';
import {BeAbleToAbort, BeAbleToTimeout} from '../index.js';
import {AsyncFunction} from '../Types.js';

/**
 * @typedef {Object} PriorityOptions
 * @description
 * The options for priority.
 */
export interface PriorityOptions {
  /**
   * @description
   * The lower the number, the sooner the promise will be run.
   * @type {number}
   */
  priority?: number;
}

/**
 * @typedef {Object} PromiseOptions
 * @description
 * The options for promise.
 */
export interface PromiseOptions extends PriorityOptions {
  /**
   * @description
   * make promise can be aborted.
   * @class PromiseWithAbortSignal
   */
  signal?: AbortSignal;
}

/**
 * @typedef {Object} AddAllOptions
 * @description
 * The options for addAll.
 */
export interface AddAllOptions extends PromiseOptions {
  /**
   * @description
   * Whether to fail fast. true = Promise.all, false = Promise.allSettled
   * @type {boolean}
   * @default false
   */
  failFast?: boolean;
}

/**
 * @typedef {Object} QueueOptions
 * @description
 * The options for queue.
 */
export interface QueueOptions {
  /**
   * @description
   * The max number of concurrently pending promises.
   * @type {number}
   * @default Number.POSITIVE_INFINITY
   */
  concurrency?: number;

  /**
   * @description
   * auto start queue.
   * @type {boolean}
   * @default true
   */
  autoStart?: boolean;

  /**
   * @description
   * make promise can be timeout.
   * @type {number}
   */
  timeout?: number;
}

const getDefaultQueueOptions = (): QueueOptions => ({
  concurrency: Number.POSITIVE_INFINITY,
  autoStart: true,
});

const lowerBound = <T>(array: readonly T[], value: T, comparator: (a: T, b: T) => number): number => {
  let first = 0;
  let count = array.length;

  while (count > 0) {
    const step = Math.trunc(count / 2);
    let it = first + step;

    if (comparator(array[it]!, value) <= 0) {
      first = ++it;
      count -= step + 1;
    } else {
      count = step;
    }
  }

  return first;
};

type RunElement = () => Promise<unknown>;

type EventName = 'active' | 'idle' | 'empty' | 'add' | 'next' | 'completed' | 'error';

export class PromiseQueue extends EventEmitter<EventName> {

  #concurrency!: number;

  timeout?: number;

  #isPaused: boolean;

  #pending = 0;

  #queue: Array<PriorityOptions & { run: (RunElement) }> = [];

  /**
   * @class PromiseQueue
   * @extends {EventEmitter}
   * @description
   * A queue for promises.
   * @example
   * import { PromiseQueue } from '@sora-soft/promise-utils';
   * const queue = new PromiseQueue({
   *  interval: 1000,
   *  concurrency: 2,
   *  timeout: 10000,
   * });
   * queue.add(async() => {
   *  return 'result';
   * })
   * @param {QueueOptions} options
   * @throws {TypeError}
   * @returns {PromiseQueue}
   * @constructor
   * @public
   * @since 1.0.0
   * @version 1.0.0
   */
  constructor(options: QueueOptions = {}) {
    super();

    options = {
      ...getDefaultQueueOptions(),
      ...options,
    };
    if (!options.concurrency || !Number.isInteger(options.concurrency) || options.concurrency < 0) {
      throw new TypeError('The concurrency must be a positive integer.');
    }
    this.concurrency = Math.ceil(options.concurrency);
    this.timeout = options.timeout;
    this.#isPaused = options.autoStart === false;
  }

  #enqueue(run: RunElement, sourceOptions: PriorityOptions): void {
    const options: PriorityOptions = {
      priority: 0,
      ...sourceOptions,
    };

    const element = {
      priority: options.priority,
      run,
    };

    if (this.size && this.#queue.at(-1)!.priority! >= options.priority!) {
      this.#queue.push(element);
      return;
    }

    const index = lowerBound(
      this.#queue, element,
      (a: Readonly<PriorityOptions>, b: Readonly<PriorityOptions>) => b.priority! - a.priority!,
    );
    this.#queue.splice(index, 0, element);
  }

  #dequeue(): RunElement | undefined {
    const item = this.#queue.shift();
    return item?.run;
  }

  get #isConcurrentAllowAnother(): boolean {
    return this.#pending < this.#concurrency;
  }

  #next(): void {
    this.#pending--;
    this.#tryToStartAnother();
    this.emit('next');
  }

  #tryToStartAnother(): boolean {
    if (this.#queue.length === 0) {

      this.emit('empty');

      if (this.#pending === 0) {
        this.emit('idle');
      }

      return false;
    }

    if (!this.#isPaused) {
      if (this.#isConcurrentAllowAnother) {
        const job = this.#dequeue();
        if (!job) {
          return false;
        }

        this.emit('active');
        void job();


        return true;
      }
    }
    return false;
  }

  #processQueue(): void {
    while (this.#tryToStartAnother()) { }
  }

  /**
   * @description
   * The max number of concurrently pending promises.
   * @returns {number}
   */
  get concurrency(): number {
    return this.#concurrency;
  }

  /**
   * @description
   * Set the max number of concurrently pending promises.
   * @param {number} newConcurrency
   * @throws {TypeError}
   * @returns {void}
   */
  set concurrency(newConcurrency: number) {
    if (!(typeof newConcurrency === 'number' && newConcurrency >= 1)) {
      throw new TypeError(`concurrency error: ${newConcurrency}`);
    }

    this.#concurrency = newConcurrency;

    this.#processQueue();
  }

  /**
   * @description
   * add promise to queue.
   * @param {PromiseLike<ReturnType> | AsyncFunction<ReturnType>} promiseOrAsync
   * @param {Partial<PromiseOptions>} options
   * @template ReturnType
   * @returns {Promise<ReturnType>}
   */
  async add<ReturnType>(promiseOrAsync: PromiseLike<ReturnType> | AsyncFunction<ReturnType>, options: PromiseOptions = {}): Promise<ReturnType> {

    if (!promiseOrAsync) {
      throw new TypeError('function_ is required.');
    }
    return new Promise((resolve, reject) => {
      this.#enqueue(async () => {
        this.#pending++;

        try {
          let operation = promiseOrAsync;
          if (options.signal) {
            operation = BeAbleToAbort(operation, {signal: options.signal});
          }
          if (this.timeout) {
            operation = BeAbleToTimeout(operation, {milliseconds: this.timeout});
          }
          operation = (operation as PromiseLike<ReturnType>).then ? (operation as PromiseLike<ReturnType>) : (operation as AsyncFunction<ReturnType>)();

          const result = await (operation);
          resolve(result);
          this.emit('completed', result);
        } catch (error: unknown) {
          reject(error);
          this.emit('error', error);
        } finally {
          this.#next();
        }
      }, options);

      this.emit('add');

      this.#tryToStartAnother();
    });
  }

  /**
   * @description
   * add promise to queue.
   * @param {ReadonlyArray<PromiseLike<ReturnType> | AsyncFunction<ReturnType>>} promiseOrAsyncs
   * @param {AddAllOptions} options
   * @template ReturnType
   * @returns {Promise<PromiseSettledResult<Awaited<ReturnType>>[] | Awaited<ReturnType>[]>}
   */
  async addAll<ReturnType>(
    promiseOrAsyncs: ReadonlyArray<PromiseLike<ReturnType> | AsyncFunction<ReturnType>>,
    options: AddAllOptions = {},
  ): Promise<PromiseSettledResult<Awaited<ReturnType>>[] | Awaited<ReturnType>[]> {
    const tasks = promiseOrAsyncs.map(async function_ => this.add(function_, options));

    if (options.failFast) {
      return Promise.all(tasks);
    } else {
      return Promise.allSettled(tasks);
    }
  }

  /**
   * @description
   * start if queue is paused.
   * @returns {this}
   */
  start(): this {
    if (!this.#isPaused) {
      return this;
    }

    this.#isPaused = false;

    this.#processQueue();
    return this;
  }

  /**
   * @description
   * pause if queue is running.
   * @returns {void}
   */
  pause(): void {
    this.#isPaused = true;
  }

  /**
   * @description
   * clear queue.
   * @returns {void}
   */
  clear(): void {
    this.#queue = [];
  }

  /**
   * @description
   * return when queue is empty.
   * @returns {Promise<void>}
   */
  async onEmpty(): Promise<void> {
    if (this.#queue.length === 0) {
      return;
    }

    await this.#onEvent('empty');
  }

  /**
   * @description
   * return when queue size less than limit.
   * @param limit
   * @returns {Promise<void>}
   */
  async onSizeLessThan(limit: number): Promise<void> {
    if (this.#queue.length < limit) {
      return;
    }

    await this.#onEvent('next', () => this.#queue.length < limit);
  }

  /**
   * @description
   * return when queue is empty and pending is 0.
   * @returns {Promise<void>}
   */
  async onIdle(): Promise<void> {
    if (this.#pending === 0 && this.#queue.length === 0) {
      return;
    }

    await this.#onEvent('idle');
  }

  async #onEvent(event: EventName, filter?: () => boolean): Promise<void> {
    return new Promise(resolve => {
      const listener = () => {
        if (filter && !filter()) {
          return;
        }

        this.off(event, listener);
        resolve();
      };

      this.on(event, listener);
    });
  }

  /**
   * @description
   * return waitting promise queue size.
   * @returns {number}
   */
  get size(): number {
    return this.#queue.length;
  }

  /**
   * @description
   * return pending count.
   * @returns {number}
   */
  get pending(): number {
    return this.#pending;
  }

  /**
   * @description
   * return queue is paused.
   * @returns {boolean}
   */
  get isPaused(): boolean {
    return this.#isPaused;
  }
}
