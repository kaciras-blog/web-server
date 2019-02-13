// 这两个太长了单独拿出来
type Onfulfilled<T, R> = ((value: T) => R | PromiseLike<R>) | undefined | null;
type Onrejected<R> = ((reason: any) => R | PromiseLike<R>) | undefined | null;


export class PromiseCompleteionSource<T> implements Promise<T> {

	promise: Promise<T>;
	resolve!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;

	constructor () {
		this.promise = new Promise((reslove, reject) => {
			this.reject = reject;
			this.resolve = reslove;
		});
	}

	get [Symbol.toStringTag] () {
		return "PromiseCompleteionSource";
	}

	then<R0 = T, R1 = never> (onfulfilled?: Onfulfilled<T, R0>, onrejected?: Onrejected<R1>) {
		return this.promise.then(onfulfilled, onrejected);
	}

	catch<R = never> (onrejected?: Onrejected<R>) {
		return this.promise.catch(onrejected);
	}

	finally (onfinally?: (() => void) | undefined | null) {
		return this.promise.finally(onfinally);
	}
}
