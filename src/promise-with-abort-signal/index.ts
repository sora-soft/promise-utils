import {TypeGuard} from '@sora-soft/type-guard';
import {AsyncFunction, PromiseExecutor} from '../Types.js';

/**
 * @typedef {Object} PromiseWithAbortSignalOptions
 */
export interface PromiseWithAbortSignalOptions {
  /**
   * @description
   * The signal to abort the promise.
   * @type {AbortSignal}
   */
  signal: globalThis.AbortSignal;
}

export class PromiseWithAbortSignal<ReturnType> implements PromiseLike<ReturnType> {
  #promise: Promise<ReturnType>;
  #signal: AbortSignal;

  /**
   * @template ReturnType
   * @class PromiseWithAbortSignal
   * @implements {PromiseLike<ReturnType>}
   * @description
   * A promise that can be aborted.
   * @example
   * import { PromiseWithAbortSignal } from '@sora-soft/promise-utils';
   * const ac = new AbortController();
   * const promiseWithAbortSignal = new PromiseWithAbortSignal((resolve) => {
   *     setTimeout(() => {
   *         resolve(result);
   *     }, 100);
   * }, { signal: ac.signal });
   * ac.abort();
   * promiseWithAbortSignal.catch((e) => {
   *     console.error(e) // DOMException [AbortError]: This operation was aborted
   * })
   * @param {PromiseExecutor<ReturnType>} executor
   * @param {PromiseWithAbortSignalOptions} options
   * @throws {TypeError}
   * @returns {PromiseWithAbortSignal<ReturnType>}
   * @constructor
   * @public
   * @since 1.0.0
   * @version 1.0.0
   */
  constructor(executor: PromiseExecutor<ReturnType>, options: PromiseWithAbortSignalOptions) {
    if (!executor) {
      throw new TypeError('executor is required.');
    }
    if (!options) {
      throw new TypeError('options is required.');
    }
    if (!options.signal) {
      throw new TypeError('options.signal is required.');
    }
    this.#signal = options.signal;
    this.#promise = new Promise((resolve, reject) => {
      const abort = () => {
        reject(this.#signal.reason);
      };
      if (this.#signal.aborted) {
        abort();
        return;
      }

      const abortAndFinalize = () => {
        abort();
        finalize();
      };
      if (this.#signal) {
        this.#signal.addEventListener('abort', abortAndFinalize, {once: true});
      }
      const finalize = () => {
        this.#signal.removeEventListener('abort', abortAndFinalize);
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
}

/**
 * @description
 * A function that returns a promise that can be aborted.
 * @example
 * import { BeAbleToAbort } from '@sora-soft/promise-utils';
 * import delay from 'delay';
 * const ac = new AbortController();
 * const promiseWithAbortSignal = BeAbleToAbort(async () => {
 *     await delay(100);
 *     return 'result';
 * }, { signal: ac.signal });
 * ac.abort();
 * promiseWithAbortSignal.catch((e) => {
 *     console.error(e); // DOMException [AbortError]: This operation was aborted
 * });
 * @template ReturnType
 * @param {PromiseLike<ReturnType> | AsyncFunction<ReturnType>} promiseOrAsync
 * @param {PromiseWithAbortSignalOptions} options
 * @returns {PromiseWithAbortSignal<ReturnType>}
 * @throws {TypeError}
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export const BeAbleToAbort = <ReturnType>(promiseOrAsync: PromiseLike<ReturnType> | AsyncFunction<ReturnType>, options: PromiseWithAbortSignalOptions) => {
  return new PromiseWithAbortSignal<ReturnType>((resolve, reject) => {
    if (TypeGuard.is<PromiseLike<ReturnType>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    } else {
      promiseOrAsync().then(resolve, reject);
    }
  }, options);
};
