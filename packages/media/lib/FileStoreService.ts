import { MediaLoadRequest, MediaSaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";

export default class FileStoreService implements WebFileService {

	protected readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	load(request: MediaLoadRequest): Promise<any> {
		return Promise.resolve(undefined);
	}

	save(request: MediaSaveRequest): Promise<string> {
		return Promise.resolve("");
	}
}
