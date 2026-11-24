#define ProductName "学不通"
#include "release-privacy-check.iss"
[Setup]
AppId={{7C772933-217C-4D40-A8CF-D4E3BCF6B845}
AppName={#ProductName}
AppVersion=2.5.15
AppVerName={#ProductName} 2.5.15
AppPublisher={#ProductName}
DefaultDirName={code:GetDefaultInstallDir}
UsePreviousAppDir=yes
DefaultGroupName={#ProductName}
UsePreviousGroup=no
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
WizardStyle=modern
OutputDir=output
OutputBaseFilename=XueBuTong-2.5.15-win-x64-setup
Compression=zip/7
LZMANumBlockThreads=1
SolidCompression=no
SetupLogging=no
CloseApplications=no
RestartApplications=no
UninstallDisplayIcon={app}\学不通.exe
InfoBeforeFile=release-docs\使用说明.txt
VersionInfoVersion=2.5.15.0
SetupIconFile=candidate\assets\fusion.ico
VersionInfoDescription=学不通安装程序
VersionInfoCompany={#ProductName}
VersionInfoProductName={#ProductName}
VersionInfoProductVersion=2.5.15.0
VersionInfoProductTextVersion=2.5.15
VersionInfoTextVersion=2.5.15
VersionInfoOriginalFileName=XueBuTong-2.5.15-win-x64-setup.exe
AllowNoIcons=yes
[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl,build-tools\ChineseSimplified.isl"
[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："
[Files]
#include "installer-files.iss"
[InstallDelete]
; Remove only the superseded root-level launch wrappers during an upgrade.
Type: files; Name: "{app}\OCS星蝉融合.exe"
; Replaced by the host with XueBuTong's Windows name, version, and icon.
Type: files; Name: "{app}\ocs-lab\OCS Desktop.exe"
Type: files; Name: "{app}\启动融合版.cmd"
Type: files; Name: "{app}\兼容模式.cmd"
Type: files; Name: "{app}\停止融合版.cmd"
; Star 1.3 replaces these four old module stubs with namespace packages.
; Leaving the 1.2 files in place would shadow the new package directories.
Type: files; Name: "{app}\star-runtime\setuptools\_distutils\compilers.pyc"
Type: files; Name: "{app}\star-runtime\setuptools\_distutils\compilers\C.pyc"
Type: files; Name: "{app}\star-runtime\setuptools\_vendor.pyc"
Type: files; Name: "{app}\star-runtime\setuptools\_vendor\jaraco.pyc"
; Superseded popup resources and JavaScript debugging maps only.
Type: files; Name: "{app}\src\star-ui-notices.js"
Type: files; Name: "{app}\src\star-ui-preload.cjs"
; Log rendering now belongs to the panel module; this old global injection is unused.
Type: files; Name: "{app}\src\star-ui-performance.js"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\xlsx\dist\xlsx.core.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\xlsx\dist\xlsx.full.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\xlsx\dist\xlsx.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\xlsx\dist\xlsx.mini.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\wmf\dist\wmf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\wmf\dist\wmf.node.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\printj\dist\printj.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\commonjs\index.min.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\node_modules\lru-cache\dist\esm\index.min.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\path-scurry\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\package-json-from-dist\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\package-json-from-dist\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\package-json-from-dist\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\package-json-from-dist\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\node-forge\dist\forge.all.min.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\node-forge\dist\forge.min.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\node-forge\dist\prime.worker.min.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minipass\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minipass\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minipass\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minipass\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\assert-valid-pattern.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\assert-valid-pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\ast.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\ast.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\brace-expressions.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\brace-expressions.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\escape.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\escape.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\unescape.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\commonjs\unescape.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\assert-valid-pattern.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\assert-valid-pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\ast.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\ast.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\brace-expressions.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\brace-expressions.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\escape.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\escape.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\unescape.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\minimatch\dist\esm\unescape.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\json-schema-typed\dist-node\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\json-schema-typed\dist-web\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\jackspeak\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\jackspeak\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\jackspeak\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\jackspeak\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\glob.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\glob.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\has-magic.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\has-magic.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\ignore.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\ignore.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\pattern.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\processor.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\processor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\walker.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\commonjs\walker.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\bin.d.mts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\bin.mjs.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\glob.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\glob.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\has-magic.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\has-magic.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\ignore.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\ignore.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\pattern.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\processor.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\processor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\walker.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\glob\dist\esm\walker.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\frac\dist\frac.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\browser.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\browser.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\cjs\signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\browser.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\browser.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\node_modules\signal-exit\dist\mjs\signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\all-signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\all-signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\proxy-signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\proxy-signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\watchdog.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\commonjs\watchdog.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\all-signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\all-signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\proxy-signals.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\proxy-signals.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\watchdog.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\foreground-child\dist\esm\watchdog.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\2019.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\ajv.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\core.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\jtd.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\errors.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\names.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\ref_error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\resolve.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\rules.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\util.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\refs\jtd-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\equal.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\parseJson.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\quote.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\re2.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\timestamp.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\ucs2length.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\uri.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\runtime\validation_error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\standalone\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\standalone\instance.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\types\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\types\json-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\types\jtd-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\code.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\draft2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\draft7.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\errors.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\metadata.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\next.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\additionalItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\additionalProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\allOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\anyOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\contains.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\dependencies.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\dependentSchemas.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\if.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\items.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\items2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\not.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\oneOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\patternProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\prefixItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\properties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\propertyNames.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\applicator\thenElse.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\core\id.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\core\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\core\ref.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\discriminator\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\discriminator\types.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\dynamic\dynamicAnchor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\dynamic\dynamicRef.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\dynamic\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\dynamic\recursiveAnchor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\dynamic\recursiveRef.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\format\format.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\format\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\discriminator.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\elements.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\enum.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\metadata.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\nullable.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\optionalProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\properties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\ref.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\type.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\union.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\jtd\values.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\unevaluated\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\unevaluated\unevaluatedItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\unevaluated\unevaluatedProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\const.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\dependentRequired.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\enum.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\limitContains.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\limitItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\limitLength.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\limitNumber.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\limitProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\multipleOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\required.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\vocabularies\validation\uniqueItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\refs\json-schema-2019-09\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\refs\json-schema-2020-12\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\codegen\code.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\codegen\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\codegen\scope.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\jtd\parse.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\jtd\serialize.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\jtd\types.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\applicability.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\boolSchema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\dataType.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\defaults.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\keyword.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\dist\compile\validate\subschema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\cfb\dist\cfb.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\dist\axios.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\dist\axios.min.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\dist\formats.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\dist\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\dist\limit.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\2019.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\ajv.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\core.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\jtd.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\errors.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\names.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\ref_error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\resolve.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\rules.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\util.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\refs\jtd-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\equal.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\parseJson.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\quote.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\re2.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\timestamp.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\ucs2length.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\uri.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\runtime\validation_error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\standalone\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\standalone\instance.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\types\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\types\json-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\types\jtd-schema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\code.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\draft2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\draft7.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\errors.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\metadata.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\next.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\additionalItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\additionalProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\allOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\anyOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\contains.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\dependencies.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\dependentSchemas.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\if.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\items.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\items2020.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\not.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\oneOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\patternProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\prefixItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\properties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\propertyNames.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\applicator\thenElse.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\core\id.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\core\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\core\ref.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\discriminator\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\discriminator\types.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\dynamic\dynamicAnchor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\dynamic\dynamicRef.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\dynamic\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\dynamic\recursiveAnchor.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\dynamic\recursiveRef.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\format\format.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\format\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\discriminator.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\elements.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\enum.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\error.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\metadata.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\nullable.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\optionalProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\properties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\ref.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\type.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\union.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\jtd\values.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\unevaluated\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\unevaluated\unevaluatedItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\unevaluated\unevaluatedProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\const.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\dependentRequired.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\enum.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\limitContains.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\limitItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\limitLength.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\limitNumber.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\limitProperties.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\multipleOf.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\pattern.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\required.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\vocabularies\validation\uniqueItems.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\refs\json-schema-2019-09\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\refs\json-schema-2020-12\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\codegen\code.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\codegen\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\codegen\scope.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\jtd\parse.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\jtd\serialize.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\jtd\types.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\applicability.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\boolSchema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\dataType.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\defaults.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\keyword.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\dist\compile\validate\subschema.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\brace-expansion\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\brace-expansion\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\brace-expansion\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\brace-expansion\dist\esm\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\balanced-match\dist\commonjs\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\balanced-match\dist\commonjs\index.js.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\balanced-match\dist\esm\index.d.ts.map"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@isaacs\balanced-match\dist\esm\index.js.map"
; Development-only files archived with SHA-256 before distribution trimming.
Type: files; Name: "{app}\ocs-lab\resources\app\electron.builder.json"
Type: files; Name: "{app}\ocs-lab\resources\app\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\readme.md"
Type: files; Name: "{app}\ocs-lab\resources\app\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\public\favicon.icns"
Type: files; Name: "{app}\ocs-lab\resources\app\src\logger.core.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\logger.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\store.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\window.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\interface.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\script.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\auto.launch.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\error.handler.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\global.listener.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\init.chrome.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\init.store.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\remote.register.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\startup.server.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\tasks\updater.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\utils\browser.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\utils\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\utils\ocr.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\worker\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\collector\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\utils\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\automation\common\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\automation\wk\cx.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\automation\wk\icve.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\automation\wk\zhs.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\src\scripts\automation\wk\zjy.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\accepts\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\body-parser\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\bytes\History.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\call-bind-apply-helpers\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\call-bound\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\content-disposition\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\content-type\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\cookie-signature\History.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\depd\History.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\dunder-proto\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\es-define-property\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\es-errors\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\es-object-atoms\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\etag\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\express\History.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\fast-uri\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\finalhandler\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\forwarded\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\fresh\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\get-proto\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\gopd\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\has-symbols\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\hasown\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\http-errors\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\math-intrinsics\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\media-typer\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\merge-descriptors\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\methods\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\mime-db\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\mime-types\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\negotiator\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\on-finished\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\parseurl\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\proxy-addr\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\range-parser\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\raw-body\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\readable-stream\GOVERNANCE.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\send\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\serve-static\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\side-channel\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\side-channel-list\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\side-channel-map\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\side-channel-weakmap\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\statuses\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\toidentifier\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\type-is\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\unpipe\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\util-deprecate\History.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\vary\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\xlsx\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ssf\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\send\node_modules\encodeurl\HISTORY.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\printj\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\node-forge\flash\README.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\frac\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\fast-uri\types\index.test-d.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\crc-32\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\2019.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\ajv.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\core.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\jtd.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\errors.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\names.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\ref_error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\resolve.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\rules.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\util.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\refs\jtd-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\equal.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\parseJson.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\quote.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\re2.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\timestamp.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\ucs2length.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\uri.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\runtime\validation_error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\standalone\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\standalone\instance.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\types\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\types\json-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\types\jtd-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\code.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\draft2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\draft7.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\errors.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\metadata.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\next.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\additionalItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\additionalProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\allOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\anyOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\contains.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\dependencies.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\dependentSchemas.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\if.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\items.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\items2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\not.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\oneOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\patternProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\prefixItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\properties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\propertyNames.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\applicator\thenElse.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\core\id.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\core\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\core\ref.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\discriminator\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\discriminator\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\dynamic\dynamicAnchor.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\dynamic\dynamicRef.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\dynamic\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\dynamic\recursiveAnchor.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\dynamic\recursiveRef.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\format\format.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\format\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\discriminator.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\elements.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\enum.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\metadata.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\nullable.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\optionalProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\properties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\ref.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\type.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\union.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\jtd\values.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\unevaluated\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\unevaluated\unevaluatedItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\unevaluated\unevaluatedProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\const.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\dependentRequired.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\enum.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\limitContains.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\limitItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\limitLength.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\limitNumber.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\limitProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\multipleOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\pattern.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\required.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\vocabularies\validation\uniqueItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\refs\json-schema-2019-09\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\refs\json-schema-2020-12\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\codegen\code.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\codegen\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\codegen\scope.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\jtd\parse.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\jtd\serialize.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\jtd\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\applicability.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\boolSchema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\dataType.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\defaults.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\keyword.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\conf\node_modules\ajv\lib\compile\validate\subschema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\codepage\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\cfb\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\cfb\node_modules\adler-32\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\lib\adapters\README.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\lib\core\README.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\lib\env\README.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\axios\lib\helpers\README.md"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\consts.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\attemptify.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\fs.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\fs_handlers.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\lang.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\retryify.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\retryify_queue.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\scheduler.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\atomically\src\utils\temp.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\src\formats.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\src\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\src\limit.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\2019.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\ajv.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\core.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\jtd.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\errors.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\names.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\ref_error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\resolve.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\rules.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\util.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\refs\jtd-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\equal.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\parseJson.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\quote.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\re2.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\timestamp.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\ucs2length.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\uri.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\runtime\validation_error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\standalone\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\standalone\instance.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\types\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\types\json-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\types\jtd-schema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\code.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\draft2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\draft7.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\errors.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\metadata.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\next.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\additionalItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\additionalProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\allOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\anyOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\contains.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\dependencies.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\dependentSchemas.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\if.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\items.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\items2020.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\not.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\oneOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\patternProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\prefixItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\properties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\propertyNames.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\applicator\thenElse.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\core\id.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\core\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\core\ref.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\discriminator\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\discriminator\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\dynamic\dynamicAnchor.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\dynamic\dynamicRef.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\dynamic\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\dynamic\recursiveAnchor.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\dynamic\recursiveRef.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\format\format.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\format\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\discriminator.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\elements.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\enum.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\error.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\metadata.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\nullable.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\optionalProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\properties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\ref.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\type.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\union.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\jtd\values.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\unevaluated\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\unevaluated\unevaluatedItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\unevaluated\unevaluatedProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\const.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\dependentRequired.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\enum.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\limitContains.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\limitItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\limitLength.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\limitNumber.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\limitProperties.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\multipleOf.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\pattern.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\required.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\vocabularies\validation\uniqueItems.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\refs\json-schema-2019-09\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\refs\json-schema-2020-12\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\codegen\code.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\codegen\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\codegen\scope.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\jtd\parse.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\jtd\serialize.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\jtd\types.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\applicability.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\boolSchema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\dataType.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\defaults.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\keyword.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\ajv-formats\node_modules\ajv\lib\compile\validate\subschema.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\adler-32\types\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\index.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\tsconfig.json"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\src\api.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\src\interface.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\src\utils\string.ts"
Type: files; Name: "{app}\ocs-lab\resources\app\node_modules\@ocs-desktop\common\src\utils\valid.browser.ts"
[Icons]
Name: "{group}\{#ProductName}"; Filename: "{app}\学不通.exe"; WorkingDir: "{app}"; IconFilename: "{app}\学不通.exe"; AppUserModelID: "XueBuTong.Desktop"
Name: "{autodesktop}\{#ProductName}"; Filename: "{app}\学不通.exe"; WorkingDir: "{app}"; IconFilename: "{app}\学不通.exe"; AppUserModelID: "XueBuTong.Desktop"; Tasks: desktopicon
Name: "{group}\学不通（兼容模式）"; Filename: "{app}\学不通.exe"; Parameters: "--software-rendering"; WorkingDir: "{app}"; IconFilename: "{app}\学不通.exe"; AppUserModelID: "XueBuTong.Desktop"
Name: "{group}\停止学不通"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -File ""{app}\tools\stop-fusion.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\学不通.exe"
Name: "{group}\卸载学不通"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\学不通.exe"; WorkingDir: "{app}"; Description: "启动 {#ProductName}"; Flags: nowait postinstall skipifsilent unchecked
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -File ""{app}\tools\stop-fusion.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopOnlyThisFusionInstallation"
[UninstallDelete]
; Runtime-generated program provenance only; no user data ownership.
Type: files; Name: "{app}\installation-provenance.json"
[Code]
#include "installer-file-checks.iss"
var
  FusionDestinationLabel: TNewStaticText;
  FusionChangingDirectory: Boolean;

function SameProgramDirectory(LeftDir, RightDir: String): Boolean;
begin
  Result := False;
  if (LeftDir = '') or (RightDir = '') then Exit;
  try
    Result := CompareText(RemoveBackslashUnlessRoot(ExpandFileName(LeftDir)),
      RemoveBackslashUnlessRoot(ExpandFileName(RightDir))) = 0;
  except
    Result := False;
  end;
end;

const FusionUninstallKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{7C772933-217C-4D40-A8CF-D4E3BCF6B845}_is1';

function RegisteredAt(RootKey: Integer): String;
var Dir: String;
begin
  Result := '';
  if not RegQueryStringValue(RootKey, FusionUninstallKey, 'Inno Setup: App Path', Dir) then
    RegQueryStringValue(RootKey, FusionUninstallKey, 'InstallLocation', Dir);
  if (Dir <> '') and DirExists(Dir) then
    if FileExists(AddBackslash(Dir) + '学不通.exe') or
       FileExists(AddBackslash(Dir) + 'OCS星蝉融合.exe') then Result := Dir;
end;

function ExistingInstallation: String;
begin
  Result := RegisteredAt(HKCU);
  if (Result = '') and IsWin64 then Result := RegisteredAt(HKLM64);
  if Result = '' then Result := RegisteredAt(HKLM32);
end;

function GetDefaultInstallDir(Param: String): String;
begin
  Result := ExistingInstallation;
  if Result = '' then
  begin
    if DirExists('D:\') then Result := 'D:\XueBuTong'
    else Result := ExpandConstant('{localappdata}\Programs\XueBuTong');
  end;
end;

function IsRegisteredProgramDirectory(Dir: String): Boolean;
begin
  Result := SameProgramDirectory(Dir, RegisteredAt(HKCU));
  if not Result and IsWin64 then Result := SameProgramDirectory(Dir, RegisteredAt(HKLM64));
  if not Result then Result := SameProgramDirectory(Dir, RegisteredAt(HKLM32));
end;

function IsOwnedProgramDirectory(Dir: String): Boolean;
var Metadata: AnsiString;
begin
  Result := IsRegisteredProgramDirectory(Dir);
  if not Result then
    if LoadStringFromFile(AddBackslash(Dir) + 'fusion-install.json', Metadata) then
      Result := (Pos('ocs-xingchan-fusion', String(Metadata)) > 0) and
        (FileExists(AddBackslash(Dir) + '学不通.exe') or
         FileExists(AddBackslash(Dir) + 'OCS星蝉融合.exe'));
end;

function HasProductDirectoryName(Dir: String): Boolean;
begin
  Result := CompareText(ExtractFileName(RemoveBackslashUnlessRoot(Dir)), 'XueBuTong') = 0;
end;

function AbsoluteInstallDirectory(Entered: String): String;
begin
  Entered := Trim(Entered);
  if (Length(Entered) > 1) and (Entered[1] = '"') and (Entered[Length(Entered)] = '"') then
    Entered := Copy(Entered, 2, Length(Entered) - 2);
  if not (((Length(Entered) >= 3) and (Entered[2] = ':') and
    ((Entered[3] = '\') or (Entered[3] = '/'))) or (Copy(Entered, 1, 2) = '\\')) then
    RaiseException('请选择完整的安装父目录，例如 D:\。');
  Result := RemoveBackslashUnlessRoot(ExpandFileName(Entered));
end;

function ProductInstallDirectory(Entered: String): String;
begin
  Result := AbsoluteInstallDirectory(Entered);
  if not HasProductDirectoryName(Result) and not IsOwnedProgramDirectory(Result) then Result := AddBackslash(Result) + 'XueBuTong';
end;

function KnownSoftwareDirectory(Dir: String): Boolean;
begin
  Result := IsOwnedProgramDirectory(Dir) or
    FileExists(AddBackslash(Dir) + '学不通.exe') or
    FileExists(AddBackslash(Dir) + 'OCS星蝉融合.exe') or
    FileExists(AddBackslash(Dir) + 'OCS Desktop.exe') or
    FileExists(AddBackslash(Dir) + '星蝉刷课.exe');
end;

function HasSoftwareParent(FinalDir: String): Boolean;
var ParentDir, NextParent: String;
begin
  Result := False;
  ParentDir := ExtractFileDir(RemoveBackslashUnlessRoot(FinalDir));
  while ParentDir <> '' do
  begin
    if KnownSoftwareDirectory(ParentDir) then
    begin
      Result := True;
      Exit;
    end;
    NextParent := ExtractFileDir(RemoveBackslashUnlessRoot(ParentDir));
    if SameProgramDirectory(ParentDir, NextParent) then Exit;
    ParentDir := NextParent;
  end;
end;

function CommandLineInstallDirectory(var Dir: String): Boolean;
var I: Integer; Argument: String;
begin
  Result := False;
  for I := 1 to ParamCount do
  begin
    Argument := ParamStr(I);
    if CompareText(Copy(Argument, 1, 5), '/DIR=') = 0 then
    begin
      Dir := Copy(Argument, 6, Length(Argument));
      Result := True;
    end;
  end;
end;

function InitializeSetup: Boolean;
var RequestedDir: String;
begin
  Result := True;
  if CommandLineInstallDirectory(RequestedDir) then
  begin
    try
      RequestedDir := AbsoluteInstallDirectory(RequestedDir);
      Result := HasProductDirectoryName(RequestedDir) or IsOwnedProgramDirectory(RequestedDir);
    except
      Result := False;
    end;
    if not Result then
      SuppressibleMsgBox('/DIR= 必须指定 XueBuTong 完整路径，或已识别的学不通旧版安装目录。', mbError, MB_OK, IDOK);
  end;
end;

procedure UpdateDestinationPreview(Sender: TObject);
begin
  if FusionDestinationLabel = nil then Exit;
  try
    FusionDestinationLabel.Caption := '最终安装位置：' + ProductInstallDirectory(WizardForm.DirEdit.Text);
  except
    FusionDestinationLabel.Caption := '请选择完整的安装父目录；程序将安装到其中的 XueBuTong 文件夹。';
  end;
end;

procedure NormalizeDirectoryEdit(Sender: TObject);
var FinalDir: String;
begin
  if FusionChangingDirectory then Exit;
  try
    FinalDir := ProductInstallDirectory(WizardForm.DirEdit.Text);
    FusionChangingDirectory := True;
    try
      WizardForm.DirEdit.Text := FinalDir;
    finally
      FusionChangingDirectory := False;
    end;
  except
    // Keep an invalid draft visible so the user can correct it.
  end;
  UpdateDestinationPreview(Sender);
end;

procedure ChooseInstallationParent(Sender: TObject);
var ParentDir, FinalDir: String;
begin
  ParentDir := WizardForm.DirEdit.Text;
  try
    ParentDir := AbsoluteInstallDirectory(ParentDir);
    if HasProductDirectoryName(ParentDir) then ParentDir := ExtractFileDir(ParentDir);
  except
    ParentDir := 'D:\';
  end;
  if not BrowseForFolder('选择安装父目录（将创建 XueBuTong 子目录）', ParentDir, True) then Exit;
  try
    FinalDir := ProductInstallDirectory(ParentDir);
    if HasSoftwareParent(FinalDir) then
      RaiseException('请选择原软件目录的父目录或其他位置，不能把新程序安装在已有软件目录内部。');
    WizardForm.DirEdit.Text := FinalDir;
    UpdateDestinationPreview(Sender);
  except
    MsgBox(GetExceptionMessage, mbError, MB_OK);
  end;
end;

procedure InitializeWizard;
var RequestedDir: String;
begin
  if CommandLineInstallDirectory(RequestedDir) then
    WizardForm.DirEdit.Text := AbsoluteInstallDirectory(RequestedDir)
  else if ExistingInstallation <> '' then
    WizardForm.DirEdit.Text := ExistingInstallation
  else
    WizardForm.DirEdit.Text := GetDefaultInstallDir('');
  WizardForm.SelectDirLabel.Caption := '新安装选择父目录；检测到旧版时默认在原目录升级。';
  WizardForm.SelectDirBrowseLabel.Caption := '新安装自动创建 XueBuTong 子目录；旧版安装目录不会重复嵌套。';
  FusionDestinationLabel := TNewStaticText.Create(WizardForm);
  FusionDestinationLabel.Parent := WizardForm.SelectDirPage;
  FusionDestinationLabel.Left := WizardForm.DirEdit.Left;
  FusionDestinationLabel.Top := WizardForm.DirEdit.Top + WizardForm.DirEdit.Height + ScaleY(12);
  FusionDestinationLabel.Width := WizardForm.SelectDirPage.ClientWidth - FusionDestinationLabel.Left;
  FusionDestinationLabel.Height := ScaleY(58);
  FusionDestinationLabel.WordWrap := True;
  WizardForm.DirEdit.OnChange := @UpdateDestinationPreview;
  WizardForm.DirEdit.OnExit := @NormalizeDirectoryEdit;
  WizardForm.DirBrowseButton.OnClick := @ChooseInstallationParent;
  UpdateDestinationPreview(nil);
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
    WizardForm.FinishedLabel.Caption := '安装完成。首次运行后，请在账号列表打开“使用引导”，按步骤配置账号并准备所需组件。';
end;

function ProvenanceJSON(InstallerHash: String): String;
var I: Integer;
begin
  InstallerHash := Lowercase(InstallerHash);
  if Length(InstallerHash) <> 64 then InstallerHash := '';
  for I := 1 to Length(InstallerHash) do
    if Pos(InstallerHash[I], '0123456789abcdef') = 0 then
    begin
      InstallerHash := '';
      Break;
    end;
  if InstallerHash = '' then
    Result := '{"schema":1,"version":"2.5.15","installerSha256":null,"sourceStatus":"unavailable"}'
  else
    Result := '{"schema":1,"version":"2.5.15","installerSha256":"' + InstallerHash + '","sourceStatus":"recorded"}';
end;

procedure WriteInstallationProvenance;
var InstallerHash: String;
begin
  InstallerHash := '';
  try
    InstallerHash := GetSHA256OfFile(ExpandConstant('{srcexe}'));
  except
    // Preserve an explicit unavailable source, never an old or invented digest.
    InstallerHash := '';
  end;
  if not SaveStringToFile(ExpandConstant('{app}\installation-provenance.json'),
    Utf8Encode(ProvenanceJSON(InstallerHash)), False) then
    SuppressibleMsgBox('学不通程序已安装，但安装包来源记录写入失败。关于页中的来源信息可能未更新。', mbError, MB_OK, IDOK);
end;

procedure RemoveOwnedLegacyShortcut(ShortcutFile: String);
var Shell, Shortcut: Variant; Target: String;
begin
  if not FileExists(ShortcutFile) then Exit;
  try
    Shell := CreateOleObject('WScript.Shell');
    Shortcut := Shell.CreateShortcut(ShortcutFile);
    Target := Shortcut.TargetPath;
    if SameProgramDirectory(Target, ExpandConstant('{app}\OCS星蝉融合.exe')) then
      DeleteFile(ShortcutFile);
  except
    // Unknown, unreadable and unrelated links stay untouched.
  end;
end;

procedure MigrateOwnedLegacyShortcuts;
begin
  RemoveOwnedLegacyShortcut(ExpandConstant('{userdesktop}\OCS 星蝉融合版.lnk'));
  RemoveOwnedLegacyShortcut(ExpandConstant('{commondesktop}\OCS 星蝉融合版.lnk'));
  RemoveOwnedLegacyShortcut(ExpandConstant('{userprograms}\OCS 星蝉融合版\OCS 星蝉融合版.lnk'));
  RemoveOwnedLegacyShortcut(ExpandConstant('{userprograms}\OCS 星蝉融合版\OCS 星蝉融合版（兼容模式）.lnk'));
end;

<event('CurStepChanged')>
procedure RecordInstallationSource(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    WriteInstallationProvenance;
    MigrateOwnedLegacyShortcuts;
  end;
end;

function IsOccupiedDirectory(Dir: String): Boolean;
var F: TFindRec;
begin
  Result := False;
  if FindFirst(AddBackslash(Dir) + '*', F) then
  begin
    try
      repeat
        if (F.Name <> '.') and (F.Name <> '..') then Result := True;
      until Result or not FindNext(F);
    finally
      FindClose(F);
    end;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpSelectDir then
  begin
    try
      WizardForm.DirEdit.Text := ProductInstallDirectory(WizardForm.DirEdit.Text);
      UpdateDestinationPreview(nil);
      if HasSoftwareParent(WizardDirValue) then
        RaiseException('请选择原软件目录的父目录或其他位置，不能把新程序安装在已有软件目录内部。');
    except
      SuppressibleMsgBox(GetExceptionMessage, mbError, MB_OK, IDOK);
      Result := False;
      Exit;
    end;
    if IsOccupiedDirectory(WizardDirValue) and not IsOwnedProgramDirectory(WizardDirValue) then
    begin
      MsgBox('请选择一个新的空目录。为保护原软件，不能覆盖已有 OCS、星蝉或其他程序目录。', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  ResetProgramFileChecks;
  ProgramFileChecksEnabled := True;
  FreshProgramDestination := not FileExists(AddBackslash(WizardDirValue) + 'fusion-install.json');
  Result := '';
  try
    if not HasProductDirectoryName(AbsoluteInstallDirectory(WizardDirValue)) and not IsOwnedProgramDirectory(WizardDirValue) then
      RaiseException('最终安装目录必须为 XueBuTong。');
    if HasSoftwareParent(WizardDirValue) then
      RaiseException('请选择原软件目录的父目录或其他位置，不能把新程序安装在已有软件目录内部。');
  except
    Result := GetExceptionMessage;
    Exit;
  end;
  if IsOccupiedDirectory(WizardDirValue) and not IsOwnedProgramDirectory(WizardDirValue) then
    Result := '请选择新的空目录，不能覆盖其他程序目录。';
end;

function StartupCommandTargets(Command, Filename: String): Boolean;
var QuotedFilename: String;
begin
  Command := Trim(Command);
  Result := CompareText(Command, Filename) = 0;
  QuotedFilename := '"' + Filename + '"';
  if Length(Command) >= Length(QuotedFilename) then
    if CompareText(Copy(Command, 1, Length(QuotedFilename)), QuotedFilename) = 0 then
      if Length(Command) = Length(QuotedFilename) then Result := True
      else Result := Command[Length(QuotedFilename) + 1] = ' ';
end;

procedure RemoveOwnedStartupValue(ValueName: String);
var StartupValue: String;
begin
  if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', ValueName, StartupValue) then
  begin
    if StartupCommandTargets(StartupValue, ExpandConstant('{app}\学不通.exe')) or
      StartupCommandTargets(StartupValue, ExpandConstant('{app}\OCS星蝉融合.exe')) then
      RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', ValueName);
  end;
end;

#include "installer-uninstall.iss"

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    RemoveOwnedStartupValue('OCS-Xingchan-Fusion');
    RemoveOwnedStartupValue('XueBuTong');
    CleanupSelectedUninstallData;
  end;
end;
