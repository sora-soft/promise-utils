
export class RetryError extends Error {
  readonly name = 'RetryError' as const;

  constructor(message?: string) {
    super(message || 'Retry timeout');
  }
}

/**
 * @typedef {Object} RetryOptions
 */
export interface RetryOptions {
  /**
   * @description
   * The maximum number of retries.
   * Use Number.POSITIVE_INFINITY for infinite retries.
   *
   * @type {number}
   * @default 10
   */
  maxRetryCount: number;
  /**
   * @description
   * The minimum time interval between retries.
   *
   * @type {number}
   * @default 1000
   */
  minTimeInterval: number;
  /**
   * @description
   * The maximum time interval between retries.
   *
   * @type {number}
   * @default Number.POSITIVE_INFINITY
   */
  maxTimeInterval: number;
  /**
   * @description
   * The maximum time to retry.
   *
   * @type {number}
   * @default Number.POSITIVE_INFINITY
   */
  maxRetryTime: number;
  /**
   * @description
   * The factor to increment the time interval between retries.
   *
   * @type {number}
   * @default 2
   */
  incrementIntervalFactor: number;
  /**
   * @description
   * Whether to randomize the time interval between retries.
   *
   * @type {boolean}
   * @default false
   */
  incrementIntervalRandomize: boolean;
  /**
   * @description
   * The function to call when an error occurs.
   *
   * @type {Function}
   * @param {Error} error
   * @param {number} currentRetryCount
   * @param {number} nextTimeInterval
   * @returns {void}
   * @default () => {}
   */
  onError: (error: Error, currentRetryCount: number, nextTimeInterval: number) => void;

  /**
   * @description
   * The function to get the timeout by the current retry count.
   * If this function is set, the options minTimeInterval, maxTimeInterval, incrementIntervalFactor, and incrementIntervalRandomize will be ignored.
   * If this function returns undefined, the retry will stop.
   *
   * @type {Function}
   * @param {number} currentRetryCount
   * @returns {number | undefined}
   * @default undefined
   */
  getTimeout?: (currentRetryCount: number) => number | undefined;
}

const getDefaultOptions = (): RetryOptions => ({
  maxRetryCount: 10,
  minTimeInterval: 1000,
  maxTimeInterval: Number.POSITIVE_INFINITY,
  maxRetryTime: Number.POSITIVE_INFINITY,
  incrementIntervalFactor: 2,
  incrementIntervalRandomize: false,
  onError: () => { },
});

export class RetryController {

  #options: RetryOptions;

  #timeoutId: NodeJS.Timeout | null = null;
  #errors: Error[] = [];
  #startTime = 0;
  #retryCount = 0;
  #cachedMainError: Error | null = null;
  #isMainErrorStale: boolean = true;

  #func: (retryCount: number) => void = () => { };
  #getNextTimeout = (currentRetryCount: number): number | undefined => {
    if (currentRetryCount >= this.#options.maxRetryCount) {
      return undefined;
    }
    if (this.#options.getTimeout) {
      return this.#options.getTimeout(currentRetryCount);
    }
    const random = (this.#options.incrementIntervalRandomize)
      ? (Math.random() + 1)
      : 1;
    const nextTimeInterval = Math.min(
      Math.round(random * Math.max(this.#options.minTimeInterval, 1)) * Math.pow(this.#options.incrementIntervalFactor, currentRetryCount),
      this.#options.maxTimeInterval,
    );
    return nextTimeInterval;
  };

  /**
   * @class RetryController
   * @description
   * A controller for retrying a function.
   * @example
   * const controller = new RetryController({
   *   maxRetryCount: 10,
   *   minTimeInterval: 500,
   *   maxTimeInterval: Number.POSITIVE_INFINITY,
   *   maxRetryTime: Number.POSITIVE_INFINITY,
   *   incrementIntervalFactor: 1,
   *   incrementIntervalRandomize: false,
   *   onError: () => { },
   * });
   * let i = 0;
   * controller.try(async (retryCount) => {
   *   controller.retry(retryCount < 5 ? new Error('test') : null);
   *   i = retryCount;
   * });
   * i // 5
   * @template ReturnType
   * @param {RetryOptions} options
   * @throws {TypeError}
   * @returns {RetryController}
   * @constructor
   * @public
   * @since 1.2.0
   * @version 1.2.0
   */
  constructor(options?: Partial<RetryOptions>) {
    this.#options = {
      ...getDefaultOptions(),
      ...options,
    };
    if (this.#options.minTimeInterval > this.#options.maxTimeInterval) {
      this.#options.maxTimeInterval = this.#options.minTimeInterval;
    }
    if (this.#options.minTimeInterval < 0) {
      throw new TypeError('minTimeInterval must be greater than or equal to 0');
    }
    if (this.#options.maxTimeInterval < 0) {
      throw new TypeError('maxTimeInterval must be greater than or equal to 0');
    }
    if (this.#options.maxRetryTime < 0) {
      throw new TypeError('maxRetryTime must be greater than or equal to 0');
    }
    if (this.#options.incrementIntervalFactor < 1) {
      throw new TypeError('incrementIntervalFactor must be greater than or equal to 1');
    }
    if (this.#options.maxRetryCount <= 0) {
      throw new TypeError('maxRetryCount must be greater than 0');
    }
  }

  #onError(error: Error, currentRetryCount: number, nextTimeInterval: number) {
    this.#options.onError(error, currentRetryCount, nextTimeInterval);
    this.#errors.push(error);
    this.#isMainErrorStale = true;
  }

  /**
   * @description
   * Retry if error is not null
   * @param {Error | null} error
   * @returns {boolean}
   */
  retry(error: Error | null) {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
    }

    if (!error) {
      return false;
    }
    const currentTime = Date.now();
    if (error && currentTime - this.#startTime >= this.#options.maxRetryTime) {
      this.#onError(error, this.#retryCount, 0);
      this.#errors = [];
      this.#onError(new RetryError('Retry timeout'), this.#retryCount, 0);
      return false;
    }

    const timeout = this.#getNextTimeout(this.#retryCount);
    this.#onError(error, this.#retryCount, timeout || 0);

    if (timeout === undefined) {
      return false;
    }

    this.#timeoutId = setTimeout(() => {
      this.#retryCount++;
      this.#func(this.#retryCount);
    }, timeout);

    return true;
  }

  /**
   * @description
   * Try to execute the function.
   * @param {(retryCount: number) => void} func
   * @returns {void}
   */
  try(func: (retryCount: number) => void) {
    this.#func = func;

    this.#startTime = Date.now();

    this.#func(this.#retryCount);
  }

  /**
   * @description
   * Reset the retry count and timeouts.
   * @returns {void}
   */
  reset() {
    this.stop();
    this.#retryCount = 0;
  }

  /**
   * @description
   * Stop retrying.
   * @returns {void}
   */
  stop() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
    }
    this.#errors = [];
    this.#isMainErrorStale = true;
    this.#cachedMainError = null;
  }

  /**
   * @description
   * Get the errors that occurred during the retry.
   * @returns {Error[]}
   */
  get errors() {
    return this.#errors;
  }

  /**
   * @description
   * Get the number of retries.
   * @returns {number}
   */
  get retryCount() {
    return this.#retryCount;
  }

  /**
   * @description
   * Get the main error that occurred during the retry.
   * @returns {Error | null}
   */
  get mainError() {
    if (!this.#isMainErrorStale && this.#errors.length === 0) {
      return null;
    }

    if (!this.#isMainErrorStale && this.#cachedMainError !== null) {
      return this.#cachedMainError;
    }

    if (this.#errors.length === 0) {
      this.#cachedMainError = null;
      this.#isMainErrorStale = false;
      return null;
    }

    const counts: {
      [message: string]: number;
    } = {};
    let mainError: Error | null = null;
    let mainErrorCount = 0;

    for (const error of this.#errors) {
      const message = error.message;
      const count = (counts[message] || 0) + 1;

      counts[message] = count;

      if (count >= mainErrorCount) {
        mainError = error;
        mainErrorCount = count;
      }
    }

    this.#cachedMainError = mainError;
    this.#isMainErrorStale = false;
    return mainError;
  }
}
