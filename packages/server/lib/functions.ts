/**
 * 包装一个函数，使其仅接受一次调用，之后的调用将忽略并返回第一次的值。
 * 如果第一次调用出现异常，则允许再次调用，直到正常返回为止。
 *
 * 该函数既可以屏蔽重复的调用，也能够用来缓存函数的返回值。
 *
 * 【实现】注意被使用的是返回的函数，不是包装函数，为了传递this所以不能返回Lambda表达式。
 *
 * @param func 原函数
 * @return 包装后的函数
 */
export function once<T, R>(func: (...args: any[]) => R) {
	let free = true;
	let returnValue: R;
	return function onceWrapper(this: T, ...args: any[]) {
		if (free) {
			returnValue = func.apply(this, args);
			free = false;
		}
		return returnValue;
	};
}

/**
 * 异步节流函数，在被封装函数的Promise没有返回前不会再次调用，而是返回第一次的Promise。
 *
 * 第一次未返回前，即使再次调用的参数不同，也只返回第一次的结果，使用时请注意，或者尽量
 * 不要使用返回值而是在Promise里处理。
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
