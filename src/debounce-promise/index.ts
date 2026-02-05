
/**
 * @typedef {Object} DebouncePromiseOptions
 * @description
 * The options for debounce promise.
 */
export interface DebouncePromiseOptions {
  /**
   * @description
   * The milliseconds to wait before calling the function.
   * @type {number}
   */
  milliseconds: number;
}

/**
 * @description
 * Make function can be debounce.
 * 
 * All callers share the same execution result. If the wrapped function throws an error or returns a rejected promise, 
 * all waiting callers will receive the same error.
 * 
 * @example
 * import { DebouncePromise } from '@sora-soft/promise-utils';
 * const func = DebouncePromise(async value => {
 *   count++;
 *   await delay(50);
 *   return value;
 * }, {milliseconds: 100});
 * const results = await Promise.all([1, 2, 3, 4, 5].map(value => func(value))); // [5, 5, 5, 5, 5]
 * 
 * @example
 * // Error handling - all concurrent calls share the same error
 * const debouncedFetch = DebouncePromise(fetch, { milliseconds: 300 });
 * try {
 *   const result = await debouncedFetch(url);
 * } catch (error) {
 *   // Handle error - all concurrent calls share this error
 * }
 * 
 * @template ArgumentsType, ReturnType
 * @param {Function} func
 * @param {DebouncePromiseOptions} options
 * @throws {TypeError} When func is not provided
 * @throws {TypeError} When options is not provided
 * @throws {TypeError} When milliseconds is not a positive integer
 * @throws {Error} When the wrapped function throws an error, all waiting callers will receive the same error
 * @returns {Function}
 * @public
 * @since 1.1.0
 * @version 1.1.0
 */
export const DebouncePromise = <ArgumentsType extends unknown[], ReturnType>
  (func: (...args: ArgumentsType) => PromiseLike<ReturnType> | ReturnType,
    options: DebouncePromiseOptions)
  : (...args: ArgumentsType) => Promise<ReturnType> => {
  if (!func) {
    throw new TypeError('func is required.');
  }
  if (!options) {
    throw new TypeError('options is required.');
  }

  let timeoutId: (NodeJS.Timeout | null) = null;
  let resolveList: ((value: ReturnType | PromiseLike<ReturnType>) => void)[] = [];
  const milliseconds = options.milliseconds;
  if (!Number.isInteger(milliseconds) || milliseconds < 0) {
    throw new TypeError('The milliseconds must be a positive integer.');
  }

  return function (..._args) {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        timeoutId = null;

        const result = Promise.resolve(func.apply(this, _args));

        for (resolve of resolveList) {
          resolve(result);
        }

        resolveList = [];
      }, milliseconds);

      resolveList.push(resolve);
    });
  };
};
