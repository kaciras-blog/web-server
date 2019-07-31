
/**
 * 包装一个函数，使其仅接受一次调用，之后的调用将忽略并返回第一次的值。
 *
 * @param func 原函数
 * @return 包装后的函数
 */
/* tslint:disable:ban-types */
export function once(func: Function) {
	let called = false;
	let returnValue: any;
	return function wrapped(...args: any[]) {
		if (called) {
			return returnValue;
		}
		called = true;
		return returnValue = func(...args);
	};
}

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

/**
 * process.hrtime() 返回的时间二元组的类型，第一个是秒，第二个是纳秒。
 * 这个数组仅用于打包两个数，不应该被修改，所以加上一个 readonly 修饰符。
 */
type SecondAndNano = readonly [number, number];

function offsetMS(from: SecondAndNano, to: SecondAndNano) {
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

/** 简单的计时器，使用 process.hrtime 高精度时间，可用于测试性能 */
export class StopWatch {

	private init!: SecondAndNano;
	private last!: SecondAndNano;

	start() {
		this.init = this.last = process.hrtime();
	}

	/**
	 * 获取计时时间和离上次调用此方法又过了多久的时间，必须先调用 start()。
	 *
	 * @return [计时时间, 两次time()的时差] 单位毫秒
	 */
	time(): [number, number] {
		const { init, last } = this;
		if (!init) {
			throw new Error("请先调用 start() 启动计时器");
		}
		const now = this.last = process.hrtime();
		return [offsetMS(init, now), offsetMS(last, now)];
	}
}
