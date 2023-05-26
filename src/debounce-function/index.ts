
/**
 * @typedef {Object} DebounceFunctionOptions
 */
export type DebounceFunctionOptions = {
  /**
   * The milliseconds to wait before calling the function.
   */
  milliseconds: number;
};

export const DebounceFunction = <ArgumentsType extends unknown[], ReturnType>(func: (...args: ArgumentsType) => PromiseLike<ReturnType> | ReturnType, options: DebounceFunctionOptions): (...args: ArgumentsType) => Promise<ReturnType> => {

  let timeoutId: (NodeJS.Timeout | null) = null;
  let resolveList:((value: ReturnType | PromiseLike<ReturnType>) => void)[] = [];
  const milliseconds = options.milliseconds;

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
