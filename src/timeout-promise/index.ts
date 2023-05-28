import {TypeGuard} from '@sora-soft/type-guard';
import {AsyncFunction, PromiseExecutor} from '../Types.js';

export class TimeoutError extends Error {
  readonly name = 'TimeoutError' as const;

  constructor(message?: string) {
    super(message || 'Promise timeout');
  }
}

/**
 * @typedef {Object} TimeoutPromiseOptions
 * @template ReturnType
 */
export interface TimeoutPromiseOptions<ReturnType> {
  /**
   * @description
   * The timeout in milliseconds.
   * @type {number}
   */
  milliseconds: number;
  /**
   * @description
   * The message to use for the error.
   * @type {string}
   */
  message?: string;
  /**
   * @description
   * The fallback value to use if the promise times out.
   * @type {ReturnType | PromiseLike<ReturnType> | (() => ReturnType | PromiseLike<ReturnType>)}
   */
  fallback?: () => ReturnType | PromiseLike<ReturnType>;
}

export class TimeoutPromise<ReturnType> implements PromiseLike<ReturnType>{
  #promise: Promise<ReturnType>;
  #abortController: AbortController;
  #timeoutId?: NodeJS.Timeout;

  /**
   * @description
   * A promise that can be timed out.
   * @example
   * import { TimeoutPromise } from '@sora-soft/promise-utils';
   * const result = 'test';
   * new TimeoutPromise((resolve) => {
   *     setTimeout(() => {
   *         resolve(result);
   *     }, 100);
   * }, { milliseconds: 50 }).catch((e) => {
   *     console.error(e); // TimeoutError: Promise timeout
   * });
   * @template ReturnType
   * @class TimeoutPromise
   * @implements {PromiseLike<ReturnType>}
   * @param {PromiseExecutor<ReturnType>} executor
   * @param {TimeoutPromiseOptions<ReturnType>} options
   * @throws {TypeError}
   * @returns {TimeoutPromise<ReturnType>}
   * @constructor
   * @public
   * @since 1.0.0
   * @version 1.0.0
   */
  constructor(executor: PromiseExecutor<ReturnType>, options: TimeoutPromiseOptions<ReturnType>) {
    if (!executor) {
      throw new TypeError('executor is required.');
    }
    if (!options) {
      throw new TypeError('options is required.');
    }
    const {
      milliseconds,
      message,
    } = options;
    this.#abortController = new AbortController();
    if (!milliseconds || !Number.isInteger(milliseconds) || milliseconds < 0) {
      this.#abortController.abort(new TypeError('The milliseconds must be a positive integer.'));
    }
    this.#promise = new Promise((resolve, reject) => {
      const abort = () => {
        reject(this.#abortController.signal.reason);
      };
      if (this.#abortController.signal.aborted) {
        abort();
        return;
      }

      const abortAndFinalize = () => {
        abort();
        finalize();
      };
      this.#abortController.signal.addEventListener('abort', abortAndFinalize, {once: true});
      const finalize = () => {
        this.#abortController.signal.removeEventListener('abort', abortAndFinalize);
      };

      const onResolve = (value: ReturnType | PromiseLike<ReturnType>) => {
        resolve(value);
        finalize();
      };

      const onReject = (error) => {
        reject(error);
        finalize();
      };

      executor(onResolve, onReject);
      this.#timeoutId = setTimeout(() => {
        if (options.fallback) {
          onResolve(options.fallback());
        } else {
          this.#abortController.abort(new TimeoutError(message));
        }
      }, milliseconds);
    });
  }

  then<TResult1 = ReturnType, TResult2 = never>(onfulfilled?: ((value: ReturnType) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<ReturnType | TResult> {
    return this.#promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<ReturnType> {
    return this.#promise.finally(onfinally);
  }

  /**
   * @description
   * Clear the timeout
   * @returns {void}
   */
  clear(): void {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = undefined;
  }
}

/**
 * @description
 * A function that returns a promise that can be timed out.
 * @example
 * import { BeAbleToTimeout } from '@sora-soft/promise-utils';
 * import delay from 'delay';
 * const result = 'test';
 * BeAbleToTimeout(async () => {
 *     return result;
 * }, {
 *     milliseconds: 50
 * }).then((res) => {
 *     console.log(res); // test
 * })
 * BeAbleToTimeout(async () => {
 *     await delay(100);
 *     return result;
 * }, {
 *     milliseconds: 50,
 *     fallback: () => {
 *         return 'fallback';
 *     }
 * }).then((res) => {
 *     console.log(res); // fallback
 * })
 * @template ReturnType
 * @param {PromiseLike<ReturnType> | AsyncFunction<ReturnType>} promiseOrAsync
 * @param {TimeoutPromiseOptions<ReturnType>} options
 * @throws {TypeError}
 * @returns {TimeoutPromise<ReturnType>}
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export const BeAbleToTimeout = <ReturnType>(promiseOrAsync: PromiseLike<ReturnType> | AsyncFunction<ReturnType>, options: TimeoutPromiseOptions<ReturnType>) => {
  return new TimeoutPromise<ReturnType>((resolve, reject) => {
    if (TypeGuard.is<PromiseLike<ReturnType>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    } else {
      promiseOrAsync().then(resolve, reject);
    }
  }, options);
};
