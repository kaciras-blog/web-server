import sharp from "sharp";

// libvips 暂不支持动画GIF，8.8版还没正式出
const image = sharp("C:\\Users\\XuFan\\Desktop\\jaanus-jagomagi-1245520-unsplash.jpg");
image.webp().toFile("C:\\Users\\XuFan\\Desktop\\test.webp").catch((err) => console.log(err));
