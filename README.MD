# Kaciras 博客前端服务

[![Build Status](https://travis-ci.org/kaciras-blog/web-server.svg?branch=master)](https://travis-ci.org/kaciras-blog/web-server)

Kaciras个人博客的前端的开发工具和页面服务器。

该项目由 [kaciras-blog/website](https://github.com/kaciras-blog/website) 使用，无法单独启动。

# 目录

* [@kaciras-blog/server](packages/server) 博客的前端服务器，处理页面和各种静态资源。

* [@kaciras-blog/image](packages/image) 图片处理工具，能够优化、转码图片。

* [@kaciras-blog/devtool](packages/devtool) 博客的开发套件，使用Webpack提供构建和热重载功能，类似于Vue-Cli。

详细的说明见各自的 README.md

# 构建

```shell script
yarn install
yarn compile
```
