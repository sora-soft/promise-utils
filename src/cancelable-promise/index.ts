import {TypeGuard} from '@sora-soft/type-guard';
import {AsyncFunction} from '../Types.js';

export class CancelError extends Error {
  readonly name = 'CancelError' as const;

  constructor(reason?: string) {
    super(reason || 'Promise was canceled');
  }
}

/**
 * @typedef {Object} OnCancel
 * @description
 * For canceling a promise.
 */
interface OnCancel {
  /**
   * @description
   * The function to call when the promise is canceled.
   * @type {Function}
   * @param {Function} handler
   * @returns {void}
   */
  cancelHandler: (handler: () => void) => void;
  /**
   * @description
   * The promise will be rejected if `shouldReject` is true, otherwise it will
   * be resolved.
   * @type {boolean}
   */
  shouldReject: boolean;
}

/**
 * @typedef {Object} CancelablePromiseState
 * @description
 * The state of the cancelable promise.
 */
const enum CancelablePromiseState {
  /**
   * @description
   * The promise is pending.
   */
  PENDING = 'pending',
  /**
   * @description
   * The promise is canceled.
   */
  CANCELED = 'canceled',
  /**
   * @description
   * The promise is resolved.
   */
  RESOLVED = 'resolved',
  /**
   * @description
   * The promise is rejected.
   */
  REJECTED = 'rejected',
}

export class CancelablePromise<ReturnType> implements PromiseLike<ReturnType> {
  #cancelHandlers: (() => void)[] = [];
  #rejectOnCancel = true;
  #state = CancelablePromiseState.PENDING;
  #promise: Promise<ReturnType>;
  #reject!: (reason?: any) => void;

  /**
   * @class CancelablePromise
   * @description
   * A promise that can be canceled.
   * @example
   * const promise = new CancelablePromise((resolve, reject, onCancel) => {
   *  onCancel.cancelHandler(() => {
   *   // Do something when the promise is canceled
   *  });
   *  setTimeout(() => {
   *    resolve('Hello world!');
   *  }, 1000);
   * });
   * promise.catch((error) => {
   *  console.error(error); // CancelError: Promise was canceled
   * });
   * promise.cancel();
   * @template ReturnType
   * @param {(resolve: (value: ReturnType | PromiseLike<ReturnType>) => void,reject: (reason?: any) => void,onCancel: OnCancel) => void} executor
   * @returns {CancelablePromise<ReturnType>}
   * @constructor
   * @public
   * @since 1.0.0
   * @version 1.0.0
   */
  constructor(executor: (
    resolve: (value: ReturnType | PromiseLike<ReturnType>) => void,
    reject: (reason?: any) => void,
    onCancel: OnCancel
  ) => void) {
    this.#promise = new Promise((resolve, reject) => {
      this.#reject = reject;

      const onResolve = (value: ReturnType) => {
        if (this.#state !== CancelablePromiseState.CANCELED || !onCancel.shouldReject) {
          resolve(value);
          this.#setState(CancelablePromiseState.RESOLVED);
        }
      };

      const onReject = (error) => {
        if (this.#state !== CancelablePromiseState.CANCELED || !onCancel.shouldReject) {
          reject(error);
          this.#setState(CancelablePromiseState.REJECTED);
        }
      };

      const onCancel: OnCancel = {
        cancelHandler: (handler) => {
          if (this.#state !== CancelablePromiseState.PENDING) {
            throw new Error(`The \`onCancel\` handler was attached after the promise ${this.#state}.`);
          }

          this.#cancelHandlers.push(handler);
        },
        shouldReject: this.#rejectOnCancel,
      };

      Object.defineProperties(onCancel, {
        shouldReject: {
          get: () => this.#rejectOnCancel,
          set: (val: boolean) => {
            this.#rejectOnCancel = val;
          },
        },
      });

      executor(onResolve, onReject, onCancel);
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
   * The addCancelHandler method adds a cancel handler to the cancel handlers list.
   * It throws an error if the promise has already been resolved or rejected.
   * The cancel handlers list is executed when the promise is canceled.
   *
   * @param {Function} handler - The cancel handler to add.
   * @returns {void}
   */
  addCancelHandler(handler: () => void) {
    if (this.#state !== CancelablePromiseState.PENDING) {
      throw new Error(`The \`addCancelHandler\` method was called after the promise ${this.#state}.`);
    }
    this.#cancelHandlers.push(handler);
  }

  /**
   * @description
   * Cancel the promise.
   *
   * @param {string} [reason] - An optional reason for canceling.
   * @returns {void}
   */
  cancel(reason?: string) {
    // If the promise is already completed, do nothing.
    if (this.#state !== CancelablePromiseState.PENDING) {
      return;
    }

    // Set the state to canceled.
    this.#setState(CancelablePromiseState.CANCELED);

    // If the promise should be rejected when canceled, reject it.
    if (this.#rejectOnCancel) {
      this.#reject(new CancelError(reason));
    }

    // If there are any cancel handlers, call them.
    if (this.#cancelHandlers.length > 0) {
      for (const handler of this.#cancelHandlers) {
        handler();
      }
    }
  }

  /**
   * @description
   * Returns true if the promise is canceled, false otherwise.
   * @returns {boolean}
   */
  get isCanceled() {
    return this.#state === CancelablePromiseState.CANCELED;
  }

  #setState(state: CancelablePromiseState) {
    if (this.#state === CancelablePromiseState.PENDING) {
      this.#state = state;
    }
  }
}

/**
 * @function BeCancelable
 * @description
 * A function that returns a cancelable promise.
 * @example
 * const promise = BeCancelable(() => {
 *  return new Promise((resolve) => {
 *    setTimeout(() => {
 *      resolve('Hello world!');
 *    }, 1000);
 *  });
 * });
 * promise.catch((error) => {
 *  console.error(error); // CancelError: Promise was canceled
 * });
 * promise.cancel();
 * @template ReturnType
 * @param {PromiseLike<ReturnType> | AsyncFunction<ReturnType>} promiseOrAsync
 * @param {(() => void)} [cancelHandler]
 * @param {boolean} [shouldReject=true]
 * @returns {CancelablePromise<ReturnType>}
 * @public
 * @since 1.0.0
 * @version 1.0.0
 */
export const BeCancelable = <T>(promiseOrAsync: PromiseLike<T> | AsyncFunction<T>, cancelHandler?: (() => void), shouldReject = true): CancelablePromise<T> => {
  return new CancelablePromise<T>((resolve, reject, onCancel) => {
    if (cancelHandler) {
      onCancel.cancelHandler(cancelHandler);
    }
    onCancel.shouldReject = shouldReject;
    if (TypeGuard.is<PromiseLike<T>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    } else {
      promiseOrAsync().then(resolve, reject);
    }
  });
};
