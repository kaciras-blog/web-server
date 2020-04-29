# Kaciras 博客前端服务

[![Build Status](https://travis-ci.org/kaciras-blog/web-server.svg?branch=master)](https://travis-ci.org/kaciras-blog/web-server)

Kaciras个人博客的前端的开发工具和页面服务器。

该项目由 [kaciras-blog/website](https://github.com/kaciras-blog/website) 使用，无法单独启动。

# 项目

* [@kaciras-blog/server](packages/server) 博客的前端服务器，处理页面和各种静态资源。

* [@kaciras-blog/image](packages/image) 图片处理工具，能够优化、转码图片。

* [@kaciras-blog/devtool](packages/devtool) 博客的开发套件，提供构建和热重载功能，类似于Vue-Cli。

详细的说明见各自的 README.md

# 构建

```shell script
yarn install
yarn compile
```

# TODOS

起初因为学习Spring才在后端使用Spring全家桶，现在看完全可以 All in JS，下一版将把全部的功能都移入这边。

Vue3.0 Beta 也出了，但因为刚出生态跟不上，所以暂时没换。但Vue2用起来确实感到很多缺陷，下一版肯定得换了，至于换哪个框架要看Vue3到底好不好了。

前端页面样式也不太好，基本都是仿的其它各种网站，等我UI设计练成就把网页全部重写( ╯-_-)╯
