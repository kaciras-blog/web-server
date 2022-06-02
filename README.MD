# Kaciras 博客前端服务

[![Test](https://github.com/kaciras-blog/web-server/actions/workflows/test.yml/badge.svg)](https://github.com/kaciras-blog/web-server/actions/workflows/test.yml)

Kaciras Blog 的前端的开发工具和页面服务器。

该项目由 [kaciras-blog/website](https://github.com/kaciras-blog/website) 使用，无法单独启动。

# 模块

* [@kaciras-blog/server](packages/server) 博客的前端服务器，处理页面请求和各种静态资源。

* [@kaciras-blog/media](packages/media) 媒体资源处理模块，处理媒体资源请求，支持优化、转码图片等功能。

* [@kaciras-blog/markdown](packages/markdown) 一些自定义的 Markdown 语法处理器。

* [@kaciras-blog/devtool](packages/devtool) 博客的开发套件，包含了构建配置，支持服务端渲染和热重载。
