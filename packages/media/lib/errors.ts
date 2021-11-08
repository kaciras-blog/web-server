/**
 * TODO：Error cause https://v8.dev/features/error-cause
 *
 * 表示用户输入的数据或参数错误。
 * 它们无法由程序处理，需要返回错误信息。
 */
export abstract class MediaError extends Error {}

/**
 * 文件数据已损坏，或是输入了无法处理的数据。
 */
export class BadDataError extends MediaError {

	/**
	 * 对异常进行转换，捕获原始异常然后抛出 BadDataError。
	 *
	 * @param error 原始异常
	 */
	static convert(error: Error): never {
		throw new BadDataError(error.message);
	}
}

/**
 * 输入的参数无法解析，或是无效的值。
 */
export class ParamsError extends MediaError {}

/**
 * 当出现一些无法继续处理的边界情况时抛出该异常，这些情况是可以预料的，应当在程序中处理。
 */
export class ProcessorError extends Error {}

// 设置 name 属性，因为似乎大多地方比起 instanceof 更喜欢用 name 判断异常类型。
MediaError.prototype.name = "MediaError";
BadDataError.prototype.name = "BadDataError";
ParamsError.prototype.name = "ParamsError";
ProcessorError.prototype.name = "ProcessorError";
