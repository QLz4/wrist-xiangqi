# 腕上象棋 1.0.6

作者：我，QLz4。这是我为小米手环 10 Pro 做的中国象棋小游戏，欢迎所有用户安装游玩、反馈问题。本项目以 MIT 协议开源，详见 LICENSE。

为小米手环 10 Pro（M2551B1、系统 3.101.043）制作的 Vela 快应用，设计分辨率为 336×480。完整 9×10 棋盘，32 枚棋子；支持五关人机、自由选关、双人轮流、合法走法提示、落子确认、悔棋、自动续局和内置规则。

## 安装和启动

安装包：`dist/com.bandgame.xiangqi.release.1.0.6.rpk`

本次只增强第五关 AI：独立实现 XQWLight 风格的主变例搜索、局面缓存和走法排序，第一至四关保持原样。默认构建改为正式 release 模式，并使用项目专用签名。具体算法、性能边界、对比记录与命令见 [ENGINE-NOTES.md](ENGINE-NOTES.md)。

1. 保持 AstroBox 显示手环已连接。
2. 将这个 RPK 导入 AstroBox 的本地安装功能，核对名称“腕上象棋”、包名 `com.bandgame.xiangqi` 后安装。
3. 在手环应用列表打开“腕上象棋”。也可用 Debug Helper 选择这个包名，启动页面 `pages/index/index`。
4. 默认人机第一关，玩家执红，红先。“菜单 → 人机关卡 · 选择难度”可任选五关，也可切换双人新局。

这是官方 aiot-toolkit 2.0.5 在 production 模式下生成、使用项目专用签名的 release 包。首次由旧 debug 包切换到此签名，可能无法直接覆盖安装；如果卸载重装，旧存档可能丢失。后续必须保持这对正式签名。真实安装及运行状态见 `验收记录.md`；打包成功和电脑预览不能代替真机验收。AstroBox 若提示不兼容、签名错误或安装失败，建议保留原始错误信息再排查，不要重置手环。

## 操作

- 点己方棋子，绿色落点表示合法走法；点落点后，再点下方“落子”。未确认前棋局不会改变。
- 点另一个己方棋子可以改选；“取消”清除选择。
- 金圈表示当前选子和待落点，蓝圈表示上一步的位置。
- 红方始终位于棋盘下方；仅双人模式黑棋文字旋转 180° 朝向对方，人机模式全部正向。
- “菜单”可继续、自由选关、新开双人、悔棋、查看规则、进入作者主页和开启交互调试。
- 人机胜利后显示通关页，可挑战下一关；第五关胜利后可重战或自由选关。通关记录自动保存，切换模式和新局不会清除。
- 新开局前会确认，因为新局会替换当前存档。
- 人机悔棋回到红方走棋前的局面；双人每次悔一步。电脑思考时也可打开菜单或悔棋。
- 每次落子、悔棋和新局都会保存。菜单下方显示保存结果。退出或熄屏会停止电脑计算，返回棋盘后继续。
- 进入游戏前台时自动请求屏幕常亮，切到后台或退出时释放。保留原来的屏幕亮度；菜单副标题显示“常亮”或“常亮失败”。常亮使用官方 [brightness.setKeepScreenOn](https://iot.mi.com/vela/quickapp/zh/features/system/brightness.html) 接口。

## 规则

车走直线、不越子；马走日且受马腿限制；炮移动不越子，吃子隔恰好一枚棋；相象走田、塞象眼不可走且不过河；仕士在九宫斜走一格；帅将在九宫横竖走一格；兵卒向前一格，过河后可横走一格，不能后退。

不能吃己方棋子，不能将帅照面，不能走出让己方将帅被攻击的一步。被将军后必须解将。轮到一方时无合法走法即负，包括将死和困毙；软件直接判胜，不要求实际吃掉将帅。

本版采用休闲和棋约定：相同棋子布局且同一方走棋累计出现三次，或连续 120 个单步（双方各走一次计两步）没有吃子，即和棋。吃子重置计数，兵卒移动本身不重置。不实现赛事中的长将、长捉责任裁判，也不提供比赛用计时、认输及提和流程。

五关均根据当前合法局面计算，不使用固定棋谱脚本。第一关保留轻量估分；后续关卡逐步增加对双方应手的搜索，第四关维持原有吃子和应将延伸；第五关单独采用 PVS、置换表、杀手/历史排序及增量评分，为本作最高难度。

| 关卡 | 搜索深度上限（单步） | 深搜节点上限 | 总时间预算 |
| --- | ---: | ---: | ---: |
| 1 入门 | 1 | 不深搜 | 350ms |
| 2 初学 | 2 | 700 | 650ms |
| 3 进阶 | 3 | 2,200 | 1,000ms |
| 4 挑战 | 4，另加 1 层战术延伸 | 5,500 | 1,500ms |
| 5 决胜 | 8，另有应将和吃子延伸 | 32,000 | 3,000ms |

先获得合法候选，再逐层搜索，只有完整完成一层才替换结果。分段计算，达到时间或节点预算即使用已完成结果；菜单、隐藏和退出可取消计算，搜索异常有合法着法兜底。预算包含切片间等待，但单次合法走法生成和系统调度不能硬实时抢占。这些是上限，不保证每局都搜满深度，也不是实际手环耗时或专业棋力等级的承诺。不同关卡可能在同一局面选择相同着法。

## Debug Helper 调试

参考源码：[Debug-Helper-AstroBox-Plugin](https://github.com/FangAiden/Debug-Helper-AstroBox-Plugin)，本次核对提交 `ca0d46a28869b400b6a185a58ebe0155e43c84d6`。

1. 手环游戏菜单点“交互调试：关”切换为“开”。每次重新启动默认关闭。
2. 插件的设备与应用页刷新列表，选择 `com.bandgame.xiangqi`，启动页面填 `pages/index/index`。
3. 在 Interconnect 页注册接收，再发送以下任意 JSON：

```json
{"cmd":"ping"}
```

```json
{"cmd":"state"}
```

游戏尝试回传 `app`、`version`、`event`、`mode`、`level`、`cleared`、`turn`、`moves`、`result` 和 90 格 `board`。调试开启时也发送落子、新局和悔棋事件。`board` 从上到下、从左到右排列，正数红、负数黑：1 将帅、2 士仕、3 象相、4 马、5 车、6 炮、7 兵卒，0 为空。

这里只提供读取状态的应用级协议，不接受远程走子或脚本执行。插件 Transport 页不用于本游戏。成功收到 `event:"ping"` 才能确认真实消息链路；协议模拟测试不代表真实传输成功。

接口依照官方 [storage](https://iot.mi.com/vela/quickapp/zh/features/data/storage.html) 和 [interconnect](https://iot.mi.com/vela/quickapp/zh/features/network/interconnect.html) 文档实现。Debug Helper 是应用启动、通信调试工具，并非系统源码级调试器。

## 构建与预览

```powershell
cd wrist-xiangqi
npm ci
npm test
npm run release
npm run preview
```

需要 Node.js 和 npm；依赖版本由 `package-lock.json` 锁定。首次构建可能在电脑的用户目录创建 `.vela`。素材已包含，无需生成；修改后可用装有 Pillow 的 Python 运行 `tools/make-assets.py`。

- `src/common/engine.js`：纯 JavaScript 规则、存档和轻量估分。
- `src/common/ai.js`：关卡配置、第一至四关原有搜索及第五关路由。
- `src/common/master-ai.js`：第五关专用 PVS、置换表、排序、战术搜索与预算控制。
- `src/pages/index/index.ux`：原生 Vela 页面、生命周期、存档、调试通信。
- `src/manifest.json`：包名、路由、设计宽度及接口声明。
- `tests/`：规则与页面逻辑测试。
- `preview/index.html`：双击可玩的电脑预览。复用应用模板、控制器和规则；浏览器存档不与手环同步。
- `tools/check-preview.cjs`：Playwright 交互检查，需提供 Playwright 和 Chrome；不模拟原生 Vela 渲染器及蓝牙接口。
- `tools/benchmark.mjs`：对比旧、新 AI 的桌面计算量；结果在 `evidence/benchmark-1.0.1.json`，不代表真机帧率。

扩展玩法时沿用 `legalMoves` 和 `play`，避免直接修改棋盘绕过规则校验。全屏页面使用 `if` 互斥创建，避免隐藏棋盘仍占布局空间，见官方 [条件渲染](https://iot.mi.com/vela/quickapp/zh/guide/framework/template/if.html)。双人黑棋使用官方 [image](https://iot.mi.com/vela/quickapp/zh/components/basic/image.html) 组件显示预先倒转的 PNG 字形，避开运行时 transform。`tools/make-black-glyphs.py` 可重新生成七种字形。

## 真机验收顺序

先检查菜单与规则无需滑动即能操作；从菜单选择第五关并走棋，检查回棋耗时和菜单响应；切双人检查黑棋倒转，切回人机检查恢复正向。胜利后检查通关页和下一关，退出重开检查棋局与关卡记录恢复。前台常亮与退出释放保持原逻辑。

## 作者与自愿支持

作者：我，QLz4。作者头像使用我提供的原图，裁切为 144×144 PNG，在屏幕上显示为 72×72。两张收款码保留原码及中心图片，提取为 294×294 PNG，四周保留至少四个模块的白边；码点为整数像素。转换后与浏览器实际截图均已离线解码，内容与原图一致，记录在 `evidence/author-qr-check.json`。

游戏不要求付款，也没有支付解锁功能；页面仅展示本地图片。真机扫码效果受屏幕和手机对焦影响，需要安装后验证。

重新生成素材可运行 `tools/make-author-assets.py --source <原图目录>`，需要 Pillow 和 zxing-cpp；若解码依赖安装在独立目录，可传 `--qr-runtime <目录>`。已包含生成后的图片，正常构建无需安装这些 Python 依赖。

## 启动动画与仓库

启动页复用作者头像，以原生 CSS opacity 关键帧完成 600ms 淡入、900ms 停留、500ms 淡出；定时器在 2000ms 后切入棋局。遵循官方 [动画样式](https://iot.mi.com/vela/quickapp/zh/components/general/animation-style.html)，不使用 transform。离开或销毁时取消定时器，后台返回不重播。实际设备动画流畅度需真机确认。

项目源码见本仓库；依赖、构建缓存、本地签名密钥不提交。安装仍由我手动操作。

## 当前 release 构建命令

```powershell
cd wrist-xiangqi
npm test
npm run release
```

我本机的签名已经准备好。如需在另一台电脑构建，请先 `npm ci` 并恢复原来的 `sign/release` 目录，再构建。`npm run build` 同样默认输出 release；仅开发调试才使用 `npm run build:debug`。初次创建新项目签名的命令是 `npm run signing:init`，不要用它替代已发布应用的原签名。本仓库不包含签名私钥。

本轮 46 项测试通过；前四关与旧版快照回归一致。第五关桌面对比与手环性能限制见 ENGINE-NOTES。release 包由我手动安装测试和上架；打包成功不是上架审核通过。

宣传素材位于 `marketing/`：3 张实际模板的预览截图，2 张内置 image_gen 生成的概念海报，提示词另有记录。
