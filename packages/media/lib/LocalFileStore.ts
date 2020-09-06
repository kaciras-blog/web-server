export interface Params {
	[key: string]: string;
}

export default class LocalFileStore {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	save(name: string, data: Buffer) {

	}

	load(name: string): Promise<ReadableStream> {

	}

	private getFilePath(name: string, params: Params) {
		const tagValues = Object.keys(params)
			.sort()
			.map(k => `${k}-${params[k]}`);
	}
}
