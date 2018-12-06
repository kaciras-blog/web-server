const fs = require("fs-extra").promises;
const path = require("path");

class ServerPluginList {

	constructor () {
		this.plugins = [];
	}

	addFirst (order, setupFunc) {
		this.plugins.push({ order, setupFunc });
	}

	addAfterCompress () {

	}

	addLast () {

	}
}

class PluginRegistration {

	constructor () {
		this.serverPlugin = [];
		this.commands = {};
	}

	addCommand (name, handler) {
		const { commands } = this;
		if (name in commands) {
			throw new Error(`Command ${name} already registered.`);
		}
		commands[name] = handler;
	}

	addServerPlugin (order, setupFunc) {
		this.serverPlugin.push({ order, setupFunc });
	}
}

module.exports = async function (args) {
	const registration = new PluginRegistration();

	const builtinPlugins = await fs.readdir(path.join(__dirname, "/plugins"));
	for (const plugin of builtinPlugins) {
		plugin(registration);
	}

	registration.serverPlugin.sort((a, b) => a.order - b.order);

	const command = args[0];
	await registration.commands[command](args);
};
