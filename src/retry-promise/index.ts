import {PromiseExecutor} from '../Types.js';
import {PromiseWithAbortSignal, PromiseWithAbortSignalOptions} from '../index.js';
import {RetryController, RetryError, RetryOptions} from './RetryController.js';

/**
 * @template ArgumentsType
 * @description
 * Make function can be retried.
 * @example
 * let i = 0;
 * const errors = [new Error('test'), new Error('test'), new Error('test'), null];
 * const func = RetryPromise((value) => {
 *  if (errors[i]) {
 *    throw errors[i++];
 *  }
 *  return value;
 * }, {
 *  onError: (error) => {
 *    console.error(error) // Error: test
 *  },
 * });
 * await func('test'); // 'test'
 * @param {Function} func
 * @param {RetryOptions} options
 * @throws {TypeError}
 * @returns {Function}
 * @public
 * @since 1.2.0
 * @version 1.2.0
 */
export const RetryPromise = <ArgumentsType extends unknown[], ReturnType>
  (func: (...args: ArgumentsType) => PromiseLike<ReturnType> | ReturnType,
    options: Partial<RetryOptions> & Partial<PromiseWithAbortSignalOptions> = {})
  : (...args: ArgumentsType) => (Promise<ReturnType> | PromiseWithAbortSignal<ReturnType>) => {
  if (!func) {
    throw new TypeError('func is required.');
  }

  return function (..._args) {
    const controller = new RetryController(options);
    const executor: PromiseExecutor<ReturnType> = (resolve, reject) => {
      const abort = () => {
        controller.stop();
        reject(options.signal?.reason);
      };
      if (options.signal) {
        if (options.signal.aborted) {
          abort();
        } else {
          options.signal.addEventListener('abort', () => {
            abort();
          }, {
            once: true,
          });
        }
      }
      controller.try(async () => {
        const onError = (error: Error | null) => {
          if (controller.retry(error)) {
            return;
          }
          reject(controller.mainError);
          controller.stop();
        };
        try {
          await Promise.resolve(func.apply(this, _args)).then((result: ReturnType) => {
            resolve(result);
          }).catch((error: Error) => {
            onError(error);
          });
        } catch (error: any) {
          onError(error as Error | null);
        }
      });
    };
    return options.signal ? new PromiseWithAbortSignal(executor, {
      signal: options.signal,
    }) : new Promise(executor);
  };
};

export {RetryController, RetryOptions, RetryError};
