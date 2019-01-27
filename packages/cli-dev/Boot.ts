import { DevelopmentApi } from "./index";
import { CliServerAPI, CliServerPligun } from "kxc-server";


export interface CliDevelopmentPlugin extends CliServerPligun {
	applyWebpack? (api: DevelopmentApi): void;
	applyDevServer? (devApi: DevelopmentApi, serverApi: CliServerAPI): void;
}

export interface CliDevelopmentConfig {
	plugins: CliDevelopmentPlugin[];
}

export class KacirasDevService {

	static run (config: CliDevelopmentConfig, args: string[]) {
		const devApi = new DevelopmentApi();
		const serv = new CliServerAPI();

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
