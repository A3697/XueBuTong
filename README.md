# 学不通 / XueBuTong

基于 OCS 网课助手的 Windows 账号与任务管理融合层。当前版本 **2.5.11**。

原创融合代码采用 [MIT](LICENSE)，OCS 及其他组件按各自许可使用，详见[第三方组件说明](docs/第三方组件说明.md)。

OCS 官网：[docs.ocsjs.com](https://docs.ocsjs.com/)

OCS 开源地址：[ocsjs/ocsjs](https://github.com/ocsjs/ocsjs)

## 本次更新

- 统一启动中按钮与取消启动按钮的高度。
- 账号设置增加“脚本选择”：OCS 与官方大学搜题酱互斥，只停用 OCS，保留其他用户脚本。选择在下次启动该账号浏览器时生效。
- 增加“学不通增强配置”标题并调整间距；搜题酱题库排在 AI 前，独立于浏览器脚本选择。
- 说明页增加 QQ 群号和二维码。

Release 的 `XueBuTong-Update-2.5.11-win-x64.exe` 适用于 **2.5.10 已有完整安装**，不是首次安装包。更新会校验目标文件、备份替换的程序并保留用户数据；文件不匹配时停止更新。

## 公开范围

本仓库是公开代码子集。星蝉受保护后端、原生前端及派生主要页面未获公开分发授权，因此不在仓库或 Release 中，不提供其解密源码。账号、密钥、登录缓存、测试数据和私人资料不发布。OCS 的主入口 JavaScript 与原创增强代码已包含；聚合的其他前端库和字体仍未公开。

| 目录 | 用途 |
|---|---|
| `src/fusion` | 账号配置、题库桥接、监控、窗口管理与 GitHub 更新。 |
| `src/backend-host` | 星蝉进程宿主和协议适配，不包含受保护业务代码。 |
| `src/native-helpers` | Windows 浏览器窗口隐藏与恢复辅助程序源码。 |
| `src/ocs-app` | 许可明确的 OCS 应用 JavaScript 和修改过的主入口；不是完整上游 TypeScript/Vue 工程。 |
| `src/star-panel` | 原创独立布局、筛选、状态与跟随模块。 |
| `assets` | 图标、说明页、公开交流群图片及许可明确的默认资源。 |
| `build` | 构建工具、安装器和测试，不含私有运行依赖。 |
| `docs`、`LICENSES` | 构建与验收说明、第三方许可。 |

## 开发与验证

独立模块可直接阅读和测试，例如：

```powershell
node --test build/test_backend_lifecycle.cjs build/test_github_updates.cjs
```

完整离线构建需要匹配的 `XueBuTong_构建依赖`、未公开资源和完整基线清单；仅克隆本仓库不能重建完整软件。构建入口不会绕过缺失文件或摘要校验。参见[源码与构建说明](docs/源码与构建说明.md)、[开源与更新](docs/开源与更新.md)。

本轮测试范围及未验证场景见 [2.5.11 修复验收](docs/2.5.11修复验收.md)。

QQ群：1067922479

<img src="assets/about/qq-group.jpg" alt="QQ群二维码" width="320">
