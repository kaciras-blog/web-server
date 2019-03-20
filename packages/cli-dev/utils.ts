// 这两个太长了单独拿出来
type OnFulfilled<T, R> = ((value: T) => R | PromiseLike<R>) | undefined | null;
type OnRejected<R> = ((reason: any) => R | PromiseLike<R>) | undefined | null;


export class PromiseCompleteionSource<T> implements Promise<T> {

	public resolve!: (value?: T | PromiseLike<T>) => void;
	public reject!: (reason?: any) => void;

	protected readonly promise: Promise<T>;

	constructor () {
		this.promise = new Promise((reslove, reject) => { this.reject = reject; this.resolve = reslove; });
	}

	get [Symbol.toStringTag] () {
		return "PromiseCompleteionSource";
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
