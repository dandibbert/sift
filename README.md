# Sift

QSpace 的搜索伴侣。按下快捷键弹出一个轻量的浮动搜索窗口，用 [fsearch](https://github.com/noahdunnagan/fsearch) 在整块磁盘上即时查找文件名或文件内容，找到后一键交回 QSpace 继续操作。

Sift 只做搜索，不做文件浏览：它不替代 Finder 或 QSpace，也不依赖 QSpace 的扩展机制。

## 下载安装

1. 打开 `Sift-<版本>.dmg`，把 Sift 拖进“Applications”。（也可以用 zip 包，解压后拖进去。）
2. 第一次打开时 macOS 会拦截，因为这个版本没有 Apple 开发者证书签名（只做了 ad-hoc 签名）。放行一次即可：
   - 双击 Sift，看到提示后点“完成”，再到“系统设置 › 隐私与安全性”里点“仍要打开”；或者
   - 在终端运行 `xattr -dr com.apple.quarantine /Applications/Sift.app`
3. 按 `⌘⇧Space` 唤起。Sift 常驻在菜单栏，不占 Dock。
4. 可选：在 Sift 的设置（`⌘,`）里点“打开‘完全磁盘访问权限’”并打开 Sift，受保护的文件夹（邮件、信息等）也能搜到。

fsearch 已经打包在 `Sift.app/Contents/MacOS/fsearch` 里，不需要另外安装。第一次启动时它会为整块磁盘建立索引（约半分钟），之后通过 FSEvents 增量更新。

支持 macOS 12 及以上，同一个包包含 Apple Silicon 和 Intel 两种架构。

重新出包：`scripts/package-macos.sh`，产物在 `build/release/`。它会先用 `scripts/build-fsearch.sh` 编译固定版本的 fsearch（需要 Rust），合成通用二进制放进 app 再签名。在 Linux 上打包还需要 [cargo-zigbuild](https://github.com/rust-cross/cargo-zigbuild) + `pip install ziglang`（交叉编译 fsearch）、[rcodesign](https://github.com/indygreg/apple-platform-rs) 和 `genisoimage`。要彻底去掉首次打开的拦截，需要 Apple Developer ID 签名并公证，在 `mygo.config.ts` 的 `macos.signingIdentity` 和 `macos.notarize` 中配置后，在 Mac 上运行 `bun run build`。

## 功能

- **全局快捷键唤起**：默认 `⌘⇧Space`，在任何应用里（包括 QSpace）都能用，可在设置中修改。失去焦点自动收起，常驻菜单栏，不占 Dock。
- **内置 fsearch 引擎**：通过 Unix socket 长连接 fsearch 守护进程（`~/Library/Application Support/FSearch/fsearch.sock`）。守护进程没在运行时，Sift 用 app 里自带的 fsearch 执行 `fsearch serve` 拉起它，退出 Sift 时一并停止；如果你自己装了 fsearch 并让它随登录启动，Sift 直接连接，不会去停它。
  - 模糊匹配，5 个字母以上的词容忍一处错字（`mian.rs` 能找到 `main.rs`）
  - `'精确`、`^前缀`、`后缀$`、`!排除`
  - 过滤器：`ext:` `type:` `kind:` `in:` `size:` `mtime:` `re:` `path:` `limit:`
  - 内容搜索：切到“内容”模式（`Tab`），或者直接写 `grep:` / `regex:` / `sym:`
- **过滤条**：类型、修改时间、大小、位置，一键套用，与 fsearch 的过滤器一一对应。
- **交回 QSpace**：

  | 操作 | 快捷键 |
  |---|---|
  | 在 QSpace 中显示（打开所在文件夹并选中） | `↵` |
  | 在 QSpace 中打开文件夹 | `⇧↵` |
  | 用默认应用打开 | `⌘↵` |
  | 快速查看（Quick Look） | `⌘Y` |
  | 在此文件夹内搜索 | `⌘⇧F` |
  | 在访达中显示 | `⌘⌥R` |
  | 复制路径 / 复制名称 | `⌘⇧C` / `⌘⌥C` |
  | 全部操作 | `⌘K`，或在结果上右键 |

  回车键的默认行为可以在设置（`⌘,`）里改成“直接打开”。
- **安静的入口**：空白时窗口只有搜索框和过滤条，窗口高度随内容伸缩；有最近使用的项目时列在下面。搜索写法的说明放在设置里。
- **最近使用**：交给 QSpace 或打开过的项目会出现在空白搜索页上。
- **兜底**：万一 fsearch 起不来，会降级到 Go 写的内置索引（扫描主目录，语法相同，速度慢得多），并在后台重试 fsearch。

### 关于“在 QSpace 中显示”

macOS 只会把“显示并选中某个文件”的请求发给**默认文件管理器**。在 QSpace 的设置里开启“设为默认文件管理器”后，Sift 能让 QSpace 直接选中文件；否则只能打开它所在的文件夹。Sift 的设置页会显示当前状态。

## 技术栈

- [MyGo](https://github.com/egoist/mygo)：Go 桌面框架，系统 WebView，无 cgo，单个二进制
- 前端：React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui，Vite 构建
- Go 与前端之间通过 MyGo 生成的类型化绑定（`src/mygo.ts`）通信

```
main.go                 桌面应用：窗口、全局快捷键、托盘、绑定给页面的服务
internal/search/        fsearch 客户端、内置降级索引、查询解析
internal/handoff/       QSpace / Finder / Quick Look 衔接（macOS），其他平台退化为系统文件管理器
internal/core/          设置、最近使用、动作分发；桌面版和浏览器预览共用
cmd/sift-preview/       在浏览器里调页面用的 HTTP 版后端
src/                    搜索窗口的页面
```

## 本地运行

需要 [Go](https://go.dev/dl/) 1.27+ 和 [Bun](https://bun.sh)。

```sh
bun install
```

开发模式下没有 app 包，Sift 会在 `PATH`、`~/.local/bin`、Homebrew 目录里找 fsearch；`scripts/build-fsearch.sh` 编出来的在 `build/fsearch/fsearch`，可以用 `SIFT_FSEARCH_BIN` 指过去。

### 桌面应用

```sh
bun run dev     # mygo dev：启动 Vite（127.0.0.1:47218）并以开发模式运行应用，改 Go 代码自动重启
bun run build   # mygo build：打包成 build/darwin-*/Sift.app 和 .dmg
```

启动后窗口会出现一次，之后按 `⌘⇧Space` 唤起，`Esc` 收起。菜单栏放大镜图标里可以退出。

### 在浏览器里调界面

页面在普通浏览器标签里没有 MyGo 运行时，这时它会改走 HTTP，调用 `cmd/sift-preview`：同一套搜索引擎，但“交给 QSpace”这类动作只会描述、不会真的执行。

```sh
scripts/make-sample-home.sh /tmp/sift-sample                  # 可选：生成一份示例主目录
bun run preview:api -- -root /tmp/sift-sample -no-fsearch    # API：127.0.0.1:47219
bun run dev:web                                               # 页面：http://127.0.0.1:47218
```

不带 `-root` 时搜索整个主目录；不带 `-no-fsearch` 时会优先连接本机的 fsearch。`/?q=report&mode=content` 可以带着初始查询打开。

### 检查

```sh
go test ./...
bun run typecheck
```

## 配置文件

设置和最近使用的记录保存在 MyGo 的用户数据目录（macOS 上是 `~/Library/Application Support/Sift/`）下的 `settings.json` 和 `recents.json`。

| 环境变量 | 作用 |
|---|---|
| `SIFT_FSEARCH_SOCKET` | 指定 fsearch 的 socket 路径 |
| `SIFT_FSEARCH_BIN` | 指定 fsearch 可执行文件（默认用 app 里自带的） |
| `SIFT_PREVIEW_PORT` | 浏览器预览 API 的端口（默认 47219） |
