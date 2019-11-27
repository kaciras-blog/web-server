import chalk, { Chalk } from "chalk";
import { Compiler, Plugin } from "webpack";
import { Hook, HookMap } from "tapable";
import { once } from "@kaciras-blog/server/lib/functions";
import StopWatch from "../StopWatch";

/**
 * 返回指定对象易读的类型字符串。
 * 对象类型将返回类名、函数返回函数名，其它返回类型名。
 *
 * @param value 某个对象
 */
function simpleTypeName(value: any): string {
	switch (typeof value) {
		case "object":
			return value.__proto__.constructor.name;
		case "function":
			return value.name;
		default:
			return typeof value;
	}
}

function isHook(tapable: Hook | HookMap): tapable is Hook {
	return tapable.tap.length === 2;
}

/** 定义命名空间的Hooks在控制台中的颜色，未定义的使用默认颜色 */
const COLOR_MAP: Readonly<{ [key: string]: Chalk }> = {
	Compiler: chalk.cyanBright,
	NormalModuleFactory: chalk.blueBright,
	ContextModuleFactory: chalk.blueBright,
	Compilation: chalk.yellowBright,
};

/**
 * 在控制台输出各种Hook用时和完成时间的插件，调试的时候用的。
 *
 * 输出格式：完成时间 [Hook耗时] - Hook命名空间: Hook名(参数...)
 *
 * TODO: 新的 Performance API 专门用于测量多个点的时间
 */
export default class HooksInspectPlugin implements Plugin {

	private stopWatch = new StopWatch();

	apply(compiler: Compiler): void {
		this.installHooks("Compiler", compiler);
		this.setupTapable("NormalModuleFactory", compiler.hooks.normalModuleFactory);
		this.setupTapable("ContextModuleFactory", compiler.hooks.contextModuleFactory);
		this.setupTapable("Compilation", compiler.hooks.thisCompilation);
		this.stopWatch.start();
	}

	private setupTapable(namespace: string, tapable: Hook) {
		tapable.tap("HookInspectSetup", once((value: any) => this.installHooks(namespace, value)));
	}

	/**
	 * 给Hook的集合对象中所有的Hook都加上日志记录器。
	 *
	 * @param namespace Hook的集合对象的名字
	 * @param hookable Hook的集合对象
	 */
	private installHooks(namespace: string, hookable: any) {
		const hooks = Object.entries(hookable.hooks) as Array<[string, Hook | HookMap]>;
		hooks.forEach(([name, hook]) => {
			const logHook = this.hookLogger(namespace, name);
			if (isHook(hook)) {
				return hook.tap(HooksInspectPlugin.name, logHook);
			}
			hook.tap(HooksInspectPlugin.name, "hookLogger", logHook);
		});
	}

	/**
	 * 创建针对指定Hook的日志记录器，在该Hook首次触发时打印一条日志。
	 *
	 * @param namespace Hook所在的类名
	 * @param name Hook名
	 * @return Hook的处理函数，在首次调用时打印日志
	 */
	private hookLogger(namespace: string, name: string) {
		return once((...args: any[]) => {
			const argInfo = args.map(simpleTypeName).join(", ");
			const [time, duration] = this.stopWatch.time();
			const color = COLOR_MAP[namespace] || chalk.reset;

			const timeLabel = `${time.toFixed(0)} [${duration.toFixed(3)}] - `;
			console.log(timeLabel + color(`${namespace}: ${name}(${argInfo})`));
		});
	}
}
