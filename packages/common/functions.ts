/**
 * 异步节流函数，在被封装函数的Promise没有返回前不会再次调用，而是返回第一次的Promise。
 *
 * 第一次未返回前，即使再次调用的参数不同，也只返回第一次的结果，使用时请注意，或者尽量
 * 不要使用返回值而是在Promise里处理。
 *
 * 【实现】注意被使用的是返回的函数，不是包装函数，为了传递this所以不能返回Lambda表达式。
 *
 * @param func 被包装函数
 * @return 节流后的函数
 */
export function debounceFirst<T, R>(func: (...args: any[]) => Promise<R>) {
	let task: Promise<R> | null = null;
	return function debounceWrapper(this: T, ...args: any[]) {
		if (task) {
			return task;
		}
		return task = func.apply(this, args).finally(() => task = null);
	};
}

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
