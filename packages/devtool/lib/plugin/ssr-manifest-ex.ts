/*
 * Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import type { ImportSpecifier } from "es-module-lexer";
import { parse as parseImports } from "es-module-lexer";
import type { OutputChunk } from "rollup";
import type { Plugin, ResolvedConfig } from "vite";
import { normalizePath } from "vite";
import { basename, dirname, join, relative } from "path";

const preloadMethod = "__vitePreload";

// 感觉 Vite 的这个插件有问题，复制过来修改下，也许会提 PR。
// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/ssr/ssrManifestPlugin.ts

export function ssrManifestPlugin(): Plugin {
	// chunk name => preload assets mapping
	const chunks: Record<string, string[]> = {};

	// module id => chunk name mapping
	const modules: Record<string, string> = {};

	let config: ResolvedConfig;
	let base: string;

	return {
		name: "vite:ssr-manifest",

		apply: config => !config.build?.ssr,

		configResolved(c) {
			config = c;
			base = config.base;
		},

		generateBundle(_, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== "chunk") {
					continue;
				}
				const { importedCss, importedAssets } = chunk.viteMetadata!;

				for (const id of Object.keys(chunk.modules)) {
					const normalizedId = normalizePath(relative(config.root, id));
					modules[normalizedId] = chunk.fileName;
				}

				const mappedChunks =
					chunks[chunk.fileName] ?? (chunks[chunk.fileName] = []);

				// <link> tags for entry chunks are already generated in static HTML,
				// so we only need to record info for non-entry chunks.
				if (!chunk.isEntry) {
					mappedChunks.push(base + chunk.fileName);
					importedCss.forEach(file => mappedChunks.push(base + file));
				}
				importedAssets.forEach(file => mappedChunks.push(base + file));

				if (!chunk.code.includes(preloadMethod)) {
					continue;
				}

				// generate css deps map
				const code = chunk.code;
				let imports: ImportSpecifier[];
				try {
					imports = parseImports(code)[0].filter(i => i.n && i.d > -1);
				} catch (e: any) {
					this.error(e, e.idx);
				}

				for (const { s: start, e: end, n: name } of imports) {
					// check the chunk being imported
					const url = code.slice(start, end);
					const deps: string[] = [];
					const ownerFilename = chunk.fileName;
					// literal import - trace direct imports and add to deps
					const analyzed: Set<string> = new Set<string>();

					const addDeps = (filename: string) => {
						if (filename === ownerFilename) return;
						if (analyzed.has(filename)) return;
						analyzed.add(filename);
						const chunk = bundle[filename] as OutputChunk | undefined;
						if (chunk) {
							chunk.viteMetadata!.importedCss.forEach(file => {
								deps.push(join(base, file));
							});
							chunk.imports.forEach(addDeps);
						}
					};
					const normalizedFile = normalizePath(
						join(dirname(chunk.fileName), url.slice(1, -1)),
					);
					addDeps(normalizedFile);
					chunks[basename(name!)] = deps;
				}
			}

			this.emitFile({
				fileName:
					typeof config.build.ssrManifest === "string"
						? config.build.ssrManifest
						: "ssr-manifest.json",
				type: "asset",
				source: JSON.stringify({ chunks, modules }, null, "\t"),
			});
		},
	};
}
