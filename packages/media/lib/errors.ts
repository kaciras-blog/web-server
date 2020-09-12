// JS 这垃圾语言实现个自定义异常坑真是多，还得靠三方库……
import { BaseError } from "make-error";

/**
 * 表示用户输入的数据或参数错误。
 * 它们无法由程序处理，需要返回错误信息。
 */
export abstract class MediaError extends BaseError {}

/**
 * 文件数据已损坏，或是输入了无法处理的数据。
 */
export class BadDataError extends MediaError {}

/**
 * 输入的参数无法解析，或是无效的值。
 */
export class ParamsError extends MediaError {}

/**
 * 当出现一些无法继续处理的边界情况时抛出该异常，这些情况是可以预料的，应当在程序中处理。
 */
export class ImageFilterException extends BaseError {}
