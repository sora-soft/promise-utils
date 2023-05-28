
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
 * @param {Function} func
 * @param {DebouncePromiseOptions} options
 * @throws {TypeError}
 * @returns {Function}
 * @example
 * const func = DebouncePromise(async value => {
 *   count++;
 *   await delay(50);
 *   return value;
 * }, {milliseconds: 100});
 * const results = await Promise.all([1, 2, 3, 4, 5].map(value => func(value))); // [5, 5, 5, 5, 5]
 * @public
 * @since 1.1.0
 * @version 1.1.0
 */
export const DebouncePromise = <ArgumentsType extends unknown[], ReturnType>
  (func: (...args: ArgumentsType) => PromiseLike<ReturnType> | ReturnType,
    options: DebouncePromiseOptions)
  : (...args: ArgumentsType) => PromiseLike<ReturnType> => {

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
