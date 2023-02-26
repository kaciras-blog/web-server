import v8 from "v8";
import { Context } from "koa";

declare function gc(): void;

export function heapSnapshot(ctx: Context) {
	ctx.body = v8.getHeapSnapshot();
	ctx.set("content-disposition", 'attachment; filename="dump.heapsnapshot"');
}

export function v8Statistics(ctx: Context) {
	ctx.body = {
		code: v8.getHeapCodeStatistics(),
		heap: v8.getHeapStatistics(),
		spaces: v8.getHeapSpaceStatistics(),
	};
}

export function runGC(ctx: Context) {
	try {
		gc();
		ctx.status = 202;
	} catch (e) {
		ctx.status = 520; // 没找到合适的码，随便写了一个。
	}
}
