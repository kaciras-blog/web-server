import { AppOptions } from "./BlogPlugin";
import { ServerOptions } from "./app";

export interface CliServerOptions {
	blog: AppOptions;
	server: ServerOptions;
}
