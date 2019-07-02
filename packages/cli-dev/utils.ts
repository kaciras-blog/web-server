// 这两个太长了单独拿出来
type OnFulfilled<T, R> = ((value: T) => R | PromiseLike<R>) | undefined | null;
type OnRejected<R> = ((reason: any) => R | PromiseLike<R>) | undefined | null;


export class PromiseCompletionSource<T> implements Promise<T> {

	public resolve!: (value?: T | PromiseLike<T>) => void;
	public reject!: (reason?: any) => void;

	protected readonly promise: Promise<T>;

	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.reject = reject;
			this.resolve = resolve;
		});
	}

	get [Symbol.toStringTag]() {
		return "PromiseCompletionSource";
	}

	then<R0 = T, R1 = never>(onFulfilled?: OnFulfilled<T, R0>, onRejected?: OnRejected<R1>) {
		return this.promise.then(onFulfilled, onRejected);
	}

	catch<R = never>(onRejected?: OnRejected<R>) {
		return this.promise.catch(onRejected);
	}

	finally(onFinally?: (() => void) | undefined | null) {
		return this.promise.finally(onFinally);
	}
}
