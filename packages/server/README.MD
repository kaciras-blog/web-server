# @kaciras-blog/server

Kaciras Blog 的页面服务器，提供对网页、图片、视频、Sitemap、Feed 流等资源的处理，支持 Vue 的服务端渲染。

# 安装

```shell script
pnpm install @kaciras-blog/server
```

# 用法

* `blog-server run` 启动服务器，可以使用 `--profile=` 来指定配置文件

* `blog-server build-cache` 生成媒体资源的缓存，在迁移和恢复备份之后运行一次
