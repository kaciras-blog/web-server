import { performance } from "perf_hooks";
import MarkdownIt from "markdown-it";
import MediaPlugin from "../lib/markdown-media";

/*
 * JS写的解析器（356.02ms）比正则（56.43ms）慢了7倍。
 * 但即便如此，单次渲染时间差也在 1ms 之内。
 */

const markdownIt = new MarkdownIt();
markdownIt.use(MediaPlugin);

async function run(name: string, text: string) {

	async function iter() {
		for (let i = 0; i < 1000; i++) markdownIt.render(text);
	}

	// warm up
	await iter();
	await iter();
	await iter();
	await iter();
	await iter();

	const start = performance.now();
	await Promise.all([iter(), iter(), iter(), iter(), iter()]);
	const end = performance.now();

	console.log("\n" + name);
	console.log(`${(end - start).toFixed(2)} ms`);
}

run("normal", "@gif[A [gif] video](/video/foobar.mp4)");

run("non-match", `
# 视频好处都有啥

视频是个好东西啊，它要不好现在的直播弹幕短视频怎么火的

@example.com: 这是我看到的最多的做法，其优势就是简单
`);
