import {EventEmitter} from 'eventemitter3';
import {BeAbleToAbort, BeAbleToTimeout} from '../index.js';
import {AsyncFunction} from '../Types.js';

export interface PriorityOptions {
  /**
   * The lower the number, the sooner the promise will be run.
   */
  priority?: number;
}

export interface PromiseOptions extends PriorityOptions {
  /**
   * make promise can be aborted.
   *
   * @class PromiseWithAbortSignal
   */
  readonly signal?: AbortSignal;
}

export interface QueueOptions {
  /**
   * The max number of concurrently pending promises.
   *
  @default Infinity
   */
  readonly concurrency?: number;

  /**
   * auto start queue.
   *
  @default true
   */
  readonly autoStart?: boolean;

  /**
   * make promise can be timeout.
   *
   * @class TimeoutPromise
   */
  timeout?: number;
}

export const lowerBound = <T>(array: readonly T[], value: T, comparator: (a: T, b: T) => number): number => {
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
   * @description
   * A queue for promises.
   * @example
   * const queue = new PromiseQueue({
   *  interval: 1000,
   *  concurrency: 2,
   *  timeout: 10000,
   * });
   * queue.add(async() => {
   *  return 'result';
   * })
   * @template ReturnType
   * @param {QueueOptions} options
   * @returns {PromiseQueue<ReturnType>}
   * @constructor
   * @public
   * @since 1.0.0
   * @version 1.0.0
   */
  constructor(options?: QueueOptions) {
    super();

    options = {
      concurrency: Number.POSITIVE_INFINITY,
      autoStart: true,
      ...options,
    } as QueueOptions;

    this.concurrency = (!options.concurrency || options.concurrency <= 0) ? Number.POSITIVE_INFINITY : Math.ceil(options.concurrency);
    this.timeout = options.timeout;
    this.#isPaused = options.autoStart === false;
  }

  #enqueue(run: RunElement, options?: Partial<PriorityOptions>): void {
    options = {
      priority: 0,
      ...options,
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

  // 完成了一个任务
  #next(): void {
    this.#pending--;
    this.#tryToStartAnother();
    this.emit('next');
  }

  // 实际尝试运行下一个任务
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
   * The max number of concurrently pending promises.
   */
  get concurrency(): number {
    return this.#concurrency;
  }

  set concurrency(newConcurrency: number) {
    if (!(typeof newConcurrency === 'number' && newConcurrency >= 1)) {
      throw new TypeError(`concurrency error: ${newConcurrency}`);
    }

    this.#concurrency = newConcurrency;

    this.#processQueue();
  }

  /**
   * add promise to queue.
   */
  async add<ReturnType>(function_: PromiseLike<ReturnType> | AsyncFunction<ReturnType>, options?: Partial<PromiseOptions>): Promise<ReturnType>;
  async add<ReturnType>(function_: PromiseLike<ReturnType> | AsyncFunction<ReturnType>, options: Partial<PromiseOptions> = {}): Promise<ReturnType> {

    return new Promise((resolve, reject) => {
      this.#enqueue(async () => {
        this.#pending++;

        try {
          let operation = function_;
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
   * add promise to queue.
   */
  async addAll<ReturnType>(
    functions: ReadonlyArray<PromiseLike<ReturnType> | AsyncFunction<ReturnType>>,
    options?: Partial<PromiseOptions>,
  ): Promise<Array<ReturnType>>;
  async addAll<ReturnType>(
    functions: ReadonlyArray<PromiseLike<ReturnType> | AsyncFunction<ReturnType>>,
    options?: Partial<PromiseOptions>,
  ): Promise<Array<ReturnType>> {
    return Promise.all(functions.map(async function_ => this.add(function_, options)));
  }

  /**
   * start if queue is paused.
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
   * pause if queue is running.
   */
  pause(): void {
    this.#isPaused = true;
  }

  /**
   * clear queue.
   */
  clear(): void {
    this.#queue = [];
  }

  /**
   * return when queue is empty.
   */
  async onEmpty(): Promise<void> {
    if (this.#queue.length === 0) {
      return;
    }

    await this.#onEvent('empty');
  }

  /**
   * return when queue size less than limit.
   */
  async onSizeLessThan(limit: number): Promise<void> {
    if (this.#queue.length < limit) {
      return;
    }

    await this.#onEvent('next', () => this.#queue.length < limit);
  }

  /**
   * return when queue is empty and pending is 0.
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
   * return queue size.
   */
  get size(): number {
    return this.#queue.length;
  }

  /**
   * return pending count.
   */
  get pending(): number {
    return this.#pending;
  }

  /**
   * return queue is paused.
   */
  get isPaused(): boolean {
    return this.#isPaused;
  }
}
