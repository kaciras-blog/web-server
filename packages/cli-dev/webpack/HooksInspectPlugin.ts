import log4js from "log4js";
import { Compiler, Plugin } from "webpack";
import { Hook, HookMap } from "tapable";

const logger = log4js.getLogger();

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

function oneShotLog(message: string) {
	let logged = false;
	return function logHook(...args: any[]) {
		if (logged) {
			return;
		}
		const argInfo = args.map(simpleTypeName).join(", ");
		logged = true;
		logger.warn(`${message}(${argInfo})`);
	};
}

function isHook(tabable: Hook | HookMap): tabable is Hook {
	return tabable.tap.length === 2;
}

export default class HooksInspectPlugin implements Plugin {

	apply(compiler: Compiler): void {
		this.installHooks("Compiler", compiler);
		this.setupTapable("NormalModuleFactory", compiler.hooks.normalModuleFactory);
		this.setupTapable("ContextModuleFactory", compiler.hooks.contextModuleFactory);
		this.setupTapable("Compilation", compiler.hooks.thisCompilation);
	}

	private setupTapable(namespace: string, tapable: Hook) {
		let installed = false;
		tapable.tap("HookInspectSetup", (value) => {
			if (installed) return;
			installed = true;
			this.installHooks(namespace, value);
		});
	}

	private installHooks(namespace: string, hookable: any) {
		const hooks = Object.entries(hookable.hooks) as Array<[string, Hook | HookMap]>;
		hooks.forEach(([name, hook]) => {
			const logHook = oneShotLog(`${namespace}: ${name}`);
			if (isHook(hook)) {
				return hook.tap(HooksInspectPlugin.name, logHook);
			}
			hook.tap(HooksInspectPlugin.name, "logHook", logHook);
		});
	}
}
