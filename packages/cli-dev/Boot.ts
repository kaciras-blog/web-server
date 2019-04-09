import ServerAPI from "kxc-server/ServerAPI";
import { DevelopmentApi } from "./build";
import { CliServerPligun } from "kxc-server";


export interface CliDevelopmentPlugin extends CliServerPligun {
	applyWebpack? (api: DevelopmentApi): void;
	applyDevServer? (devApi: DevelopmentApi, serverApi: ServerAPI): void;
}

export interface CliDevelopmentConfig {
	plugins: CliDevelopmentPlugin[];
}

export class KacirasDevService {

	static run (config: CliDevelopmentConfig, args: string[]) {
		const devApi = new DevelopmentApi();
		const serv = new ServerAPI();

		for (const plugin of config.plugins) {
			if (plugin.applyWebpack) {
				plugin.applyWebpack(devApi);
			}
		}
		for (const plugin of config.plugins) {
			if (plugin.applyDevServer) {
				plugin.applyDevServer(devApi, serv);
			}
		}


	}
}
