const path = require("path");
const fs = require("fs-extra");
const { WebImageService } = require("../packages/server/image-service");
const { LocalFileStore }  = require("../packages/server/image-store");

async function upgrade() {
	const store = new LocalFileStore(dir);
	const service = new WebImageService(store);
	store.save = () => {};

	for (const file of await fs.readdir(".")) {
		const buffer = await fs.readFile(file);
		await service.save(buffer, path.extname(file).substring(1));
		console.log("迁移图片 " + file)
	}
}

const dir = process.argv[2];
if (!dir) {
	console.error("请在参数中指定图片存储目录");
	process.exit(1);
}
process.chdir(dir);

upgrade()
	.then(() => console.log("图片迁移完毕！"))
	.catch(e => console.error(e.message, e));
