import { AppOptions } from "./BlogPlugin";
import { ServerOptions } from "./infra/app";

export interface CliServerOptions {
	blog: AppOptions;
	server: ServerOptions;
}
