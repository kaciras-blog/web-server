import { AppOptions } from "./BlogPlugin";
import { ServerOptions } from "./app";

export interface CliServerOptions extends AppOptions, ServerOptions {
	blog: AppOptions;
	server: ServerOptions;
}
