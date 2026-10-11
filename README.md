# Sift

QSpace 的搜索伴侣。按下快捷键弹出一个轻量的浮动搜索窗口，用 [fsearch](https://github.com/noahdunnagan/fsearch) 在整块磁盘上即时查找文件名或文件内容，找到后一键交回 QSpace 继续操作。

Sift 只做搜索，不做文件浏览：它不替代 Finder 或 QSpace，也不依赖 QSpace 的扩展机制。

## 功能

- **全局快捷键唤起**：默认 `⌘⇧Space`，在任何应用里（包括 QSpace）都能用，可在设置中修改。失去焦点自动收起，常驻菜单栏，不占 Dock。
- **fsearch 引擎**：通过 Unix socket 长连接 fsearch 守护进程（`~/Library/Application Support/FSearch/fsearch.sock`），守护进程没在运行时会自动执行 `fsearch serve` 拉起。
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
- **最近使用**：交给 QSpace 或打开过的项目会出现在空白搜索页上。
- **没装 fsearch 也能用**：会降级到内置索引（扫描主目录，语法相同，速度慢得多），状态栏会显示黄色提示，装好 fsearch 后自动切换。

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

### 安装 fsearch（推荐）

```sh
git clone https://github.com/noahdunnagan/fsearch
cd fsearch && cargo build --release
./target/release/fsearch install --login   # 安装到 ~/.local/bin，并随登录启动守护进程
```

在“系统设置 › 隐私与安全性 › 完全磁盘访问权限”里给 `~/.local/bin/fsearch` 授权，否则受保护的文件夹不会被索引。

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
| `SIFT_FSEARCH_BIN` | 指定 fsearch 可执行文件 |
| `SIFT_PREVIEW_PORT` | 浏览器预览 API 的端口（默认 47219） |
