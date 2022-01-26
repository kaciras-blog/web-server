export * from "./options.d";

export { default as getViteConfig } from "./build-config.js";

export { default as serve } from "./command/serve.js";
export { default as build } from "./command/build.js";

export { default as vueSvgComponent } from "./plugin/vue-svg-component.js";
export { default as compressAssets } from "./plugin/compress-assets.js";
export { default as processImage } from "./plugin/process-image.js";
export { default as optimizeImage } from "./plugin/optimize-image.js";
