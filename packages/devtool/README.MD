# 项目简介

Kaciras Blog 的开发套件，包含了构建配置，支持服务端渲染和热重载。

# 用法

```shell script
npm install @kaciras-blog/devtool
```

然后在 package.json 里加入：

```json
{
  "scripts": {
    "serve": "blog-devtool serve",
    "build": "blog-devtool build"
  }
}
```

* serve: 启动具有热重载功能的开发服务器

* build: 构建项目，可以使用 `--profile=` 指定配置文件
