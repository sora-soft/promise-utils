import {TypeGuard} from '@sora-soft/type-guard';
import {PromiseExecutor} from '../Types.js';

/**
 * @typedef {Object} PromiseWithAbortSignalOptions
 * @property {AbortSignal} signal
 */
export type PromiseWithAbortSignalOptions = {
  signal: globalThis.AbortSignal;
};

/**
 * @class PromiseWithAbortSignal
 * @description
 * A promise that can be aborted.
 * @example
 * const controller = new AbortController();
 * const promise = new PromiseWithAbortSignal((resolve, reject) => {
 *  controller.signal.addEventListener('abort', () => {
 *    // Do something when the promise is aborted
 *  });
 *  setTimeout(() => {
 *    resolve('Hello world!');
 *  }, 1000);
 * }, {
 *  signal: controller.signal,
 * });
 * promise.catch((error) => {
 *  console.error(error); // CancelError: This operation was aborted
 * });
 * controller.abort();
 * @template ReturnType
 * @param {PromiseExecutor<ReturnType>} executor
 * @param {PromiseWithAbortSignalOptions} options
 * @returns {PromiseWithAbortSignal<ReturnType>}
 * @constructor
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export class PromiseWithAbortSignal<ReturnType> implements PromiseLike<ReturnType> {
  #promise: Promise<ReturnType>;
  #signal: AbortSignal;

  constructor(executor: PromiseExecutor<ReturnType>, options: PromiseWithAbortSignalOptions) {
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
 * @function BeAbleToAbort
 * @description
 * A function that returns a promise that can be aborted.
 * @example
 * const controller = new AbortController();
 * const promise = BeAbleToAbort(() => {
 *  controller.signal.addEventListener('abort', () => {
 *   // Do something when the promise is aborted
 *  });
 *  return new Promise((resolve) => {
 *    setTimeout(() => {
 *      resolve('Hello world!');
 *    }, 1000);
 *  });
 * }, {
 *  signal: controller.signal,
 * });
 * promise.catch((error) => {
 *  console.error(error); // CancelError: This operation was aborted
 * });
 * controller.abort();
 * @template ReturnType
 * @param {PromiseLike<ReturnType> | (() => PromiseLike<ReturnType>)} promiseOrAsync
 * @param {PromiseWithAbortSignalOptions} options
 * @returns {PromiseWithAbortSignal<ReturnType>}
 * @constructor
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export const BeAbleToAbort = <ReturnType>(promiseOrAsync: PromiseLike<ReturnType> | (() => PromiseLike<ReturnType>), options: PromiseWithAbortSignalOptions) => {
  return new PromiseWithAbortSignal<ReturnType>((resolve, reject) => {
    if (TypeGuard.is<PromiseLike<ReturnType>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    } else {
      promiseOrAsync().then(resolve, reject);
    }
  }, options);
};
