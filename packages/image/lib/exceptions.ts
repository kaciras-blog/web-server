// JS 这垃圾语言实现个自定义异常坑真是多，还得靠三方库……
import { BaseError } from "make-error";

/** 输入数据或参数错误，它们无法由程序处理，有必要返回错误信息给用户 */
export abstract class InputDataError extends BaseError {}

/** 图片数据已损坏，或是输入了非图片数据 */
export class BadImageError extends InputDataError {}

/** 输入的参数无法解析 */
export class FilterArgumentError extends InputDataError {}

/** 当出现一些无法继续处理的边界情况时抛出该异常，这些情况是可以预料的 */
export class ImageFilterException extends BaseError {}
