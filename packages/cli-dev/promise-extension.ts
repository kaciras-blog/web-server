// 这两个太长了单独拿出来
type OnFulfilled<T, R> = ((value: T) => R | PromiseLike<R>) | undefined | null;
type OnRejected<R> = ((reason: any) => R | PromiseLike<R>) | undefined | null;

export abstract class PromiseDelegate<T> implements Promise<T> {

	protected readonly promise: Promise<T>;

	protected constructor (promise: Promise<T>) {
		this.promise = promise;
	}

	get [Symbol.toStringTag] () {
		return "PromiseDelegate";
	}

	then<R0 = T, R1 = never> (onfulfilled?: OnFulfilled<T, R0>, onrejected?: OnRejected<R1>) {
		return this.promise.then(onfulfilled, onrejected);
	}

	catch<R = never> (onrejected?: OnRejected<R>) {
		return this.promise.catch(onrejected);
	}

	finally (onfinally?: (() => void) | undefined | null) {
		return this.promise.finally(onfinally);
	}
}

export class PromiseCompleteionSource<T> extends PromiseDelegate<T> {

	public resolve!: (value?: T | PromiseLike<T>) => void;
	public reject!: (reason?: any) => void;

	constructor () {
		super(new Promise((reslove, reject) => { this.resolve = reslove; this.reject = reject; }));
	}

	get [Symbol.toStringTag] () {
		return "PromiseCompleteionSource";
	}
}
