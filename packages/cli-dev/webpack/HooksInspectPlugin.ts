import chalk, { Chalk } from "chalk";
import { Compiler, Plugin } from "webpack";
import { Hook, HookMap } from "tapable";


class StopWatch {

	private startSecond!: number;
	private startNano!: number;

	start() {
		[this.startSecond, this.startNano] = process.hrtime();
	}

	milliseconds() {
		const [second, nano] = process.hrtime();
		return (second - this.startSecond) * 1000 + (nano - this.startNano) / 1000000;
	}
}

function simpleTypeName(value: any): string {
	switch (typeof value) {
		case "string":
			return "string";
		case "object":
			return value.__proto__.constructor.name;
		case "function":
			return value.name;
		default:
			return value.toString();
	}
}

function isHook(tabable: Hook | HookMap): tabable is Hook {
	return tabable.tap.length === 2;
}

export default class HooksInspectPlugin implements Plugin {

	private stopWatch = new StopWatch();

	apply(compiler: Compiler): void {
		this.stopWatch.start();
		this.installHooks("Compiler", chalk.cyanBright, compiler);
		this.setupTapable("NormalModuleFactory", chalk.blueBright, compiler.hooks.normalModuleFactory);
		this.setupTapable("ContextModuleFactory", chalk.blueBright, compiler.hooks.contextModuleFactory);
		this.setupTapable("Compilation", chalk.yellowBright, compiler.hooks.thisCompilation);
	}

	private setupTapable(namespace: string, color: Chalk, tapable: Hook) {
		let installed = false;
		tapable.tap("HookInspectSetup", (value) => {
			if (installed) return;
			installed = true;
			this.installHooks(namespace, color, value);
		});
	}

	private installHooks(namespace: string, color: Chalk, hookable: any) {
		const hooks = Object.entries(hookable.hooks) as Array<[string, Hook | HookMap]>;
		hooks.forEach(([name, hook]) => {
			const logHook = this.logHook(`${namespace}: ${name}`, color);
			if (isHook(hook)) {
				return hook.tap(HooksInspectPlugin.name, logHook);
			}
			hook.tap(HooksInspectPlugin.name, "logHook", logHook);
		});
	}

	private logHook(message: string, color: Chalk) {
		let logged = false;
		return (...args: any[]) => {
			if (logged) {
				return;
			}
			logged = true;
			const argInfo = args.map(simpleTypeName).join(", ");
			const offset = this.stopWatch.milliseconds().toFixed(2);
			console.log(offset + " - " + color(`${message}(${argInfo})`));
		};
	}
}
