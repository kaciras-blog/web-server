import chalk, { Chalk } from "chalk";
import { Compiler, Plugin } from "webpack";
import { Hook, HookMap } from "tapable";


/**
 * process.hrtime() 返回的时间二元组的类型，第一个是秒，第二个是纳秒。
 * 这个数组仅用于打包两个数，不应该被修改，所以加上一个 readonly 修饰符。
 */
type SecondAndNano = readonly [number, number];

function offsetMS(from: SecondAndNano, to: SecondAndNano) {
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

class StopWatch {

	private init!: SecondAndNano;
	private last!: SecondAndNano;

	start() {
		this.init = this.last = process.hrtime();
	}

	/**
	 * 获取计时时间和离上次调用此方法又过了多久的时间，必须先调用 start()。
	 *
	 * @return [计时时间, 两次time()的时差]
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

/* tslint:disable:ban-types */
function once(func: Function) {
	let called = false;
	return function wrapped(...args: any[]) {
		if (called) {
			return;
		}
		called = true;
		func(...args);
	};
}

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

function isHook(tabable: Hook | HookMap): tabable is Hook {
	return tabable.tap.length === 2;
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

	private installHooks(namespace: string, hookable: any) {
		const hooks = Object.entries(hookable.hooks) as Array<[string, Hook | HookMap]>;
		hooks.forEach(([name, hook]) => {
			const logHook = this.logHook(namespace, name);
			if (isHook(hook)) {
				return hook.tap(HooksInspectPlugin.name, logHook);
			}
			hook.tap(HooksInspectPlugin.name, "logHook", logHook);
		});
	}

	private logHook(namespace: string, name: string) {
		return once((...args: any[]) => {
			const argInfo = args.map(simpleTypeName).join(", ");
			const [time, duration] = this.stopWatch.time();
			const color = COLOR_MAP[namespace] || chalk.reset;

			const timeLabel = `${time.toFixed(0)} [${duration.toFixed(3)}] - `;
			console.log(timeLabel + color(`${namespace}: ${name}(${argInfo})`));
		});
	}
}
