/**
 * 给资源的外层加上个 <template> 包裹，使其被 vue-loader 识别为组件的模板。
 *
 * 本加载器需要配合 vue-loader 使用。
 *
 * @see https://github.com/visualfanatic/vue-svg-loader/blob/dev/index.js
 */
export default (html: string) => `<template>${html}</template>`;
