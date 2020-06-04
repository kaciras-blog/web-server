import { Context } from "koa";

/**
 *
 */
export interface WebFileService {

	save(ctx: Context): Promise<any>;

	load(name: string, ctx: Context): Promise<any>;

	getAllNames(): Promise<string[]>;
}
