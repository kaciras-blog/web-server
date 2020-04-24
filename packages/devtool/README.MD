# 项目简介

Kaciras个人博客的构建工具，以及开发的热重载支持。

# 用法

```shell script
npm install @kaciras-blog/devtool
```

然后在 package.json 里加入：

```json
{
  "scripts": {
    "serve": "blog-devtool serve",
    "build": "blog-devtool build",
    "build-prod": "blog-devtool build --profile=prod"
  }
}
```

* serve: 启动具有热重载功能的开发服务器
* build: 使用默认的配置(config/index.js)构建
* build-prod: 使用指定的配置文件(config/prod.js)构建

# TODO

* 去除 nodeExternals 和 babel-loader 的 include 中硬编码的三方依赖。
* 去除 resolve.modules 和 resolveLoader 里开发时才用得到的路径
