import {TypeGuard} from '@sora-soft/type-guard';
import {PromiseExecutor} from '../Types.js';

export class TimeoutError extends Error {
  readonly name = 'TimeoutError' as const;

  constructor(message?: string) {
    super(message || 'Promise timeout');
  }
}

/**
 * @typedef {Object} TimeoutPromiseOptions
 * @property {number} milliseconds
 * @property {string} [message]
 * @property {() => ReturnType | PromiseLike<ReturnType>} [fallback]
 * @template ReturnType
 */
export type TimeoutPromiseOptions<ReturnType> = {
  milliseconds: number;
  message?: string;
  fallback?: () => ReturnType | PromiseLike<ReturnType>;
};

/**
 * @class TimeoutPromise
 * @description
 * A promise that can be timed out.
 * @example
 * const promise = new TimeoutPromise((resolve, reject) => {
 *  setTimeout(() => {
 *    resolve('Hello world!');
 *  }, 1000);
 * }, {
 *  milliseconds: 500,
 *  message: 'Promise timed out',
 *  fallback: () => {
 *    return 'Fallback value';
 *  },
 * });
 * promise.catch((error) => {
 *  console.error(error); // TimeoutError: Promise timeout
 * });
 * @template ReturnType
 * @param {PromiseExecutor<ReturnType>} executor
 * @param {TimeoutPromiseOptions<ReturnType>} options
 * @returns {TimeoutPromise<ReturnType>}
 * @constructor
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export class TimeoutPromise<ReturnType> implements PromiseLike<ReturnType>{
  #promise: Promise<ReturnType>;
  #abortController: AbortController;
  #timeoutId?: NodeJS.Timeout;

  constructor(executor: PromiseExecutor<ReturnType>, options: TimeoutPromiseOptions<ReturnType>) {
    const {
      milliseconds,
      message,
    } = options;
    if (typeof milliseconds !== 'number' || Math.sign(milliseconds) !== 1) {
      throw new TypeError(`Expected \`milliseconds\` to be a positive number, got \`${milliseconds}\``);
    }
    this.#abortController = new AbortController();
    this.#promise = new Promise((resolve, reject) => {
      const abort = () => {
        reject(this.#abortController.signal.reason);
      };
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
   * Clear the timeout
   */
  clear(): void {
    clearTimeout(this.#timeoutId);
    this.#timeoutId = undefined;
  }
}

/**
 * @function BeAbleToTimeout
 * @description
 * A function that returns a promise that can be timed out.
 * @example
 * const promise = BeAbleToTimeout(() => {
 *  return new Promise((resolve, reject) => {
 *    setTimeout(() => {
 *      resolve('Hello world!');
 *    }, 1000);
 *  });
 * }, {
 *  milliseconds: 500,
 *  message: 'Promise timed out',
 *  fallback: () => {
 *    return 'Fallback value';
 *  },
 * });
 * promise.catch((error) => {
 *  console.error(error); // TimeoutError: Promise timeout
 * });
 * @template ReturnType
 * @param {PromiseLike<ReturnType> | (() => PromiseLike<ReturnType>)} promiseOrAsync
 * @param {TimeoutPromiseOptions<ReturnType>} options
 * @returns {TimeoutPromise<ReturnType>}
 * @constructor
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export const BeAbleToTimeout = <ReturnType>(promiseOrAsync: PromiseLike<ReturnType> | (() => PromiseLike<ReturnType>), options: TimeoutPromiseOptions<ReturnType>) => {
  return new TimeoutPromise<ReturnType>((resolve, reject) => {
    if (TypeGuard.is<PromiseLike<ReturnType>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    } else {
      promiseOrAsync().then(resolve, reject);
    }
  }, options);
};
