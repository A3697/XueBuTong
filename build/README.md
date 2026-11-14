# 离线基线构建工具

此工具从公开源码目录与独立依赖目录重建已审核的学不通 2.5.3 发布输入，再编译安装包。不会启动学不通、执行安装器、下载安装依赖、清理已有目录或重置任何用户数据。

## 入口

在源码根目录中运行：

```powershell
.\build.ps1
```

也可明确指定三个独立目录；相对路径以当前 PowerShell 目录为基准：

```powershell
.\build.ps1 -DependencyRoot '..\XueBuTong_构建依赖' -WorkRoot '..\XueBuTong_构建缓存\manual-001' -OutputRoot '..\XueBuTong_发行包\2.5.3-rebuild-001'
```

默认值均以源码文件夹的父目录为基准：

- 依赖：`XueBuTong_构建依赖`。
- 工作区：`XueBuTong_构建缓存/<源码文件夹名称>-<当前时间>`。
- 输出：`XueBuTong_发行包/2.5.3`。

工作区必须不存在或为空。源码、依赖、工作区及输出目录不能相互包含。不覆盖同名安装包或构建报告；重复构建时指定新的 OutputRoot。失败时保留工作区供检查，不自动删除文件。

`build.ps1` 使用依赖中的 `runtime/python3144/python.exe -I -S -B -X utf8` 调用 `build/build.py`，无需系统 Python、Node.js、C# 编译器或联网安装。需要 Windows x64 和能正常运行依赖内 Python、Inno Setup 的环境。

## 清单与构建过程

1. 验证源码 `source-manifest.json` 与依赖 `dependency-manifest.json` 的完整文件集合、大小和 SHA-256；拒绝缺失、增加、修改、重复或越界路径，拒绝符号链接、目录联接和其他重解析点。
2. 验证 `build/dependency-provenance.json` 中的启动器源码与预编译 EXE 摘要，以及 Python、OCS、星蝉版本。
3. 将依赖 `runtime` 复制到新工作区的 `candidate`，从源码覆盖融合逻辑、后端主机、星蝉页面、OCS 页面和资源，生成 OCS bootstrap。
4. 与 `build/release-input-manifest.json` 完整比较，要求重建 candidate 与本次审核的发布载荷逐文件一致。
5. 运行复制到工作区的 `audit_release.py`、`generate_installer_files.py`。其中包含隐私检查、星蝉运行库清单检查及 Python 源码语法检查，生成安装器的精确文件列表与校验元数据。
6. 使用工作区 `build-tools/InnoSetup/ISCC.exe` 编译安装器。直接调用 ISCC 时，原有 `release-privacy-check.iss` 仍使用 candidate 内 Python 再次检查发布清单。中文语言文件采用相对路径。

所有修改仅写入指定工作区和输出目录。源码和依赖只读。原始 `.iss` 的安装、升级、卸载逻辑保留。

## 源码与运行依赖的对应关系

| 来源 | 重建后的路径 |
|---|---|
| 依赖 `runtime/*` | `candidate/*` |
| 源码 `src/fusion/*` | `candidate/src/*` |
| 源码 `src/backend-host/*` | `candidate/tools/*` |
| 源码 `src/star-panel/*` | `candidate/star-runtime/web/dist/*` |
| 源码 `src/ocs-app/*` | `candidate/ocs-lab/resources/app/*` |
| 源码 `assets/*` | `candidate/assets/*` |
| 源码 `fusion-install.json` | `candidate/fusion-install.json` |
| 源码 `src/fusion/electron-bootstrap.cjs` | `candidate/ocs-lab/resources/app/xingchan-lab-bootstrap.cjs` |
| 依赖 `tools/*` | 工作区 `build-tools/*` |
| 源码 `docs/*` | 工作区 `release-docs/*` |

依赖目录需要包括 `runtime/学不通.exe`、`runtime/python3144`、星蝉受保护运行库、Electron、随附 Chrome、OCS 的 node_modules，以及 `tools/InnoSetup`、`tools/ChineseSimplified.isl`。它们与源码分开发送。星蝉受保护模块属于二进制依赖，不代表已取得其未加密源码。

## 结果与限制

- 工作区 `build-log.jsonl`：逐阶段记录。
- 工作区 `build-result.json`：成功或失败结果、载荷检查、安装包大小与摘要。
- 工作区 `audit_release.py.log`、`generate_installer_files.py.log`、`compiler.log`：检查和编译输出。
- 输出目录：安装包与同名 `.build.json` 来源报告。

这是**已审核基线的载荷重建**工具，不会自动为修改后的业务源码更新清单，也不会绕过隐私门禁。修改功能后，需要重新评审、验证并生成相应发布清单；修改 C# 启动器则还需在适当环境中重新编译和更新其来源摘要。当前构建使用与随附 Launcher.cs 对应的预编译启动器。

载荷逐文件一致不代表安装器 EXE 必然逐字节一致：编译时间等安装器元数据可能不同。最终安装包摘要始终以本次实际生成结果为准。

## 工具自身验证

可运行标准库测试，无须启动产品或安装器：

```powershell
& '..\XueBuTong_构建依赖\runtime\python3144\python.exe' -I -S -B -X utf8 '.\build\test_build.py'
```

测试覆盖清单集合与摘要、越界及重复路径、无效元数据、重解析点拒绝和非空工作区保护。完整安装包构建的实际验证结果请看随附交付验证说明；仅通过上述工具测试不能代替完整构建验证。


## ScriptCat 实际安装回归

在已安装学不通和 Node.js 的测试电脑上，设置 `XBT_RUNTIME_ROOT` 为程序目录，执行 `node build/verify_script_installation.cjs`。测试新建无账号浏览器配置，通过本机临时 HTTP 地址验证随附脚本的安装、同版本更新、失败重试与摘要不符。不会读取或修改真实账号配置；保留测试记录的路径会在控制台显示。
