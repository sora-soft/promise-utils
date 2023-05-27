import {PromiseExecutor} from '../Types.js';
import {PromiseWithAbortSignal, PromiseWithAbortSignalOptions} from '../index.js';
import {RetryController, RetryError, RetryOptions} from './RetryController.js';

/**
 * @description
 * A function that can be retried.
 * @param {Function} func
 * @param {RetryOptions} options
 * @returns {Function}
 * @example
 * let i = 0;
 * const errors = [new Error('test'), new Error('test'), new Error('test'), null];
 * const func = RetryFunction((value) => {
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
 * @public
 * @since 1.2.0
 * @version 1.2.0
 */
export const RetryFunction = <ArgumentsType extends unknown[], ReturnType>
  (func: (...args: ArgumentsType) => PromiseLike<ReturnType> | ReturnType,
    options?: Partial<RetryOptions> & Partial<PromiseWithAbortSignalOptions>)
  : (...args: ArgumentsType) => PromiseLike<ReturnType> => {

  return function (..._args) {
    const controller = new RetryController(options);
    const executor: PromiseExecutor<ReturnType> = (resolve, reject) => {
      const abort = () => {
        controller.stop();
        reject(options?.signal?.reason);
      };
      if (options?.signal) {
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
    return options?.signal ? new PromiseWithAbortSignal(executor, {
      signal: options.signal,
    }) : new Promise(executor);
  };
};

export {RetryController, RetryOptions, RetryError};
