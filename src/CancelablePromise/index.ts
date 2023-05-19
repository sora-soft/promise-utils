import {TypeGuard} from '@sora-soft/type-guard';

export class CancelError extends Error {
  readonly name = 'CancelError' as const;

  constructor(reason?: string) {
    super(reason || 'Promise was canceled');
  }
}

interface OnCancelFunction {
  cancelHandler: (handler: () => void) => void;
  shouldReject: boolean;
}

const enum CancelablePromiseState {
  PENDING = 'pending',
  CANCELED = 'canceled',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export class CancelablePromise<ReturnType> implements PromiseLike<ReturnType> {
  #cancelHandlers: (() => void)[] = [];
  #rejectOnCancel = true;
  #state = CancelablePromiseState.PENDING;
  #promise: Promise<ReturnType>;
  #reject!: (reason?: any) => void;

  constructor(executor: (
    resolve: (value: ReturnType | PromiseLike<ReturnType>) => void,
    reject: (reason?: any) => void,
    onCancel: OnCancelFunction
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

      const onCancel: OnCancelFunction = {
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

  addCancelHandler(handler: () => void) {
    if (this.#state !== CancelablePromiseState.PENDING) {
      throw new Error(`The \`addCancelHandler\` method was called after the promise ${this.#state}.`);
    }
    this.#cancelHandlers.push(handler);
  }

  cancel(reason?: string) {
    if (this.#state !== CancelablePromiseState.PENDING) {
      return;
    }

    this.#setState(CancelablePromiseState.CANCELED);

    if (this.#rejectOnCancel) {
      this.#reject(new CancelError(reason));
    }

    if (this.#cancelHandlers.length > 0) {
      for (const handler of this.#cancelHandlers) {
        handler();
      }
    }
  }

  get isCanceled() {
    return this.#state === CancelablePromiseState.CANCELED;
  }

  #setState(state: CancelablePromiseState) {
    if (this.#state === CancelablePromiseState.PENDING) {
      this.#state = state;
    }
  }
}

export const BeCancelable = <T>(promiseOrAsync: PromiseLike<T> | (() => PromiseLike<T>), cancelHandler?: (() => void), shouldReject = true): CancelablePromise<T> => {
  return new CancelablePromise<T>((resolve, reject, onCancel) => {
    if (cancelHandler) {
      onCancel.cancelHandler(cancelHandler);
    }
    onCancel.shouldReject = shouldReject;
    if (TypeGuard.is<PromiseLike<T>>(promiseOrAsync)) {
      promiseOrAsync.then(resolve, reject);
    }else{
      promiseOrAsync().then(resolve, reject);
    }
  });
};