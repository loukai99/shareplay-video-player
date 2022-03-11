# 支持多方同步播放的SPlayer
可异地同步播放视频播放器

基于射手影音修改，同步功能基于leancloud的即时通讯服务实现，支持多客户端同步播放，暂停，倍速，拖动进度条功能，异地恋神器。

## 使用方法
1. `yarn install`安装依赖，可能需要梯子
2. `npm run build`尝试打包，若成功再做后续的修改工作
3. 注册一个leancloud账号[leancloud官网](https://www.leancloud.cn/) ，leancloud为开发者提供120次/分钟的免费消息次数，足够使用
4. 在leancloud控制台中创建新的应用，在*设置-应用凭证*可以看到自己的AppID等基本信息，将其填到./src/renderer/containers/VideoCanvas.vue文件的92-94行需要修改的内容
5. 再次打包应用并打开播放一次视频，这时leancloud会生成一个房间的 conversation id，在*leancloud控制台>即时通讯>对话*下面，复制到/src/renderer/containers/VideoCanvas.vue文件的182行的roomID即可。
6. 重新打包，可以使用啦！

> 后续有空会将上述修改内容做出图形化可修改的直接放到应用中，并发布release版本。现阶段有开发经验的可以尝试。



This project was generated with [electron-vue](https://github.com/SimulatedGREG/electron-vue)@[7c4e3e9](https://github.com/SimulatedGREG/electron-vue/tree/7c4e3e90a772bd4c27d2dd4790f61f09bae0fcef) using [vue-cli](https://github.com/vuejs/vue-cli). Documentation about the original structure can be found [here](https://simulatedgreg.gitbooks.io/electron-vue/content/index.html).
