export class PromiseCompleteionSource<T> {

	promise: Promise<T>;
	reslove!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;

	constructor () {
		this.promise = new Promise((reslove, reject) => {
			this.reject = reject;
			this.reslove = reslove;
		});
	}
}
