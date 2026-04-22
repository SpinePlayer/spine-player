# spine-web-player

基于 [Spine](https://esotericsoftware.com/) 官方运行时（Canvas / WebGL）封装的 Web 端 Spine 动画播放库，支持单实例与多实例管理，并提供 Vue3 组件。

## 相关链接

- **[演示地址](https://spineplayer.github.io/spine-playground/)** - 在线体验 Spine Playground
- **[API 文档](https://spineplayer.github.io/spine-player-docs/)** - spine-web-player API 文档
- **[Player 仓库](https://github.com/SpinePlayer/spine-player)** - spine-web-player 代码仓库

## 特性

> - 可选 webgl/canvas2d/auto 渲染方式，默认 auto(优先 webgl、自动降级 canvas2d)
> - 支持 Shader 滤镜: 内置常用滤镜效果，同时支持自定义 FragmentShader 代码传入。
> - 丰富的 API: 提供更加简洁的使用 api，如动画切换、皮肤和插槽更换等。
> - 纹理压缩支持：支持 astc 格式的 ktx2 文件

## 安装

```bash
pnpm add spine-web-player
# 或
npm i spine-web-player
```

## 使用方式

### 1. 原生 / 任意框架（SpinePlayer）

挂载一个容器（如 `canvas` 或 `div`），创建 `SpinePlayer` 并加载资源：

```ts
import SpinePlayer from "spine-web-player";

const container = document.querySelector("#container"); // 或 HTMLCanvasElement
const player = new SpinePlayer(container, {
  type: "auto", // 'auto' | 'webgl' | 'canvas2d'
  onUpdate: (time, drawCall) => {},
});

await player.loadSpine({
  loop: true,
  autoPlay: true,
  assets: {
    skel: "https://example.com/xxx.skel", // 或 .json
    atlas: "https://example.com/xxx.atlas",
    useKTX2: false,
  },
});

// 控制
player.play("run");
player.pause();
player.getAnimations();
```

### 2. Vue3 组件（v-spine-player）

```vue
<template>
  <div class="player-wrap">
    <v-spine-player
      ref="playerRef"
      :assets="assets"
      :loop="true"
      :animation-name="animationName"
      @loaded="onLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { VSpinePlayer } from "spine-web-player/vue3";

const assets = {
  skel: "/path/to/xxx.skel",
  atlas: "/path/to/xxx.atlas",
};
const animationName = ref("idle");
const playerRef = ref();

function onLoaded(player) {
  console.log("动画列表", player.getAnimations());
}

// 获取底层 SpinePlayer 实例
const rawPlayer = playerRef.value?.getPlayer();
</script>
```

全局注册：

```ts
import { createApp } from "vue";
import { VSpinePlayerPlugin } from "spine-web-player/vue3";
import App from "./App.vue";

const app = createApp(App);
app.use(VSpinePlayerPlugin, { name: "VSpinePlayer" });
app.mount("#app");
```

### 3. 多实例管理（SpineManage）

同一画布内管理多个 Spine 实例（层级、暂停/恢复、统一渲染等）：

```ts
import { SpineManage, SpineTools } from "spine-web-player";

const container = document.querySelector("#container");
const manager = new SpineManage(container, {
  /* 渲染配置 */
});

await manager.loadSpine({
  uuid: "spine-1",
  loop: true,
  autoPlay: true,
  bound: SpineTools.viewportBound({ x: 0, y: 0, width: 250, height: 250 }, 750),
  assets: { skel: "...", atlas: "..." },
});

manager.playAnimation("spine-1", { animationName: "run" });
manager.pause("spine-1");
manager.resume("spine-1");
```

---

#### 发布版本规则

> 大版本号需与官方 Spine 大版本号一致

#### 更新日志

*** 4.2.3 ***

- 更新`README`和`package.json`

*** 4.2.1 ***

- fix 正在加载资源时 dispose 实例导致的报错
- 增加`isDisposed`状态用以判断当前实例是否已被销毁

*** 4.2.0 ***

- 初始化版本

## GitHub Star 实时成长曲线

通过 Star History 的实时图表追踪 GitHub Star 增长趋势：

[![Star History Chart](https://api.star-history.com/svg?repos=SpinePlayer/spine-player&type=Date)](https://github.com/SpinePlayer/spine-player)
