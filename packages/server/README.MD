# 项目简介

Kaciras个人博客的页面服务器，提供对网页、图片、Feed流等资源的处理，支持Vue的服务端渲染。

# 用法

```shell script
npm install @kaciras-blog/server
```

然后在 package.json 里加入：

```json
{
  "scripts": {
    "start": "blog-server run"
  }
}
```

运行 `npm run start` 即可启动生产模式的服务器。

