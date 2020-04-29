# 项目简介

Kaciras个人博客的页面服务器，提供对网页、图片、Sitemap、Feed流等资源的处理，支持Vue的服务端渲染。

# 安装

```shell script
npm install @kaciras-blog/server
```

# 用法

* `blog-server run` 启动服务器，可以使用 `--profile=` 来指定配置文件

* `blog-server build-image-cache` 构建图片缓存，在迁移和恢复备份之后运行一次
