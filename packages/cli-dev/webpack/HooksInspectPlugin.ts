import chalk, { Chalk } from "chalk";
import { Compiler, Plugin } from "webpack";
import { Hook, HookMap } from "tapable";


type SecondAndNano = [number, number];

function offsetMillisecond(from: SecondAndNano, to: SecondAndNano) {
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

class StopWatch {

	private init!: SecondAndNano;
	private last!: SecondAndNano;

	start() {
		this.init = this.last = process.hrtime();
	}

	time() {
		const now = process.hrtime();
		const { init, last } = this;
		this.last = now;
		return [offsetMillisecond(init, now), offsetMillisecond(last, now)];
	}
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

export default class HooksInspectPlugin implements Plugin {

	private stopWatch = new StopWatch();

	apply(compiler: Compiler): void {
		this.installHooks("Compiler", chalk.cyanBright, compiler);
		this.setupTapable("NormalModuleFactory", chalk.blueBright, compiler.hooks.normalModuleFactory);
		this.setupTapable("ContextModuleFactory", chalk.blueBright, compiler.hooks.contextModuleFactory);
		this.setupTapable("Compilation", chalk.yellowBright, compiler.hooks.thisCompilation);
		this.stopWatch.start();
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
			const [time, duration] = this.stopWatch.time();

			const timeLabel = `${time.toFixed(0)} [${duration.toFixed(3)}] - `;
			console.log(timeLabel + color(`${message}(${argInfo})`));
		};
	}
}
