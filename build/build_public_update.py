"""Build an existing-install-only update from reviewed manifests.

Default scope remains public code only. A separately reviewed Star delta may
explicitly include protected runtime/frontend assets, never user state.
The installed Inno uninstall log is appended so the original files stay owned.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import files_under, digest, no_links, claim_empty
from public_scope import public_payload
from release_privacy import require_clean
from star_runtime_delta import entries, validate_review, allowed_path, BACKEND_MANIFEST


def quote(value):
    return value.replace("'", "''")


def build_update(args):
    source, candidate, work, deps, output = [Path(value).absolute() for value in
                                           (args.source, args.candidate, args.work, args.dependencies, args.output)]
    for folder in (source, candidate, work, deps, output):
        no_links(folder)
    claim_empty(work)
    baseline = Path(args.baseline).absolute()
    old = entries(baseline)
    current = {name: {'path': name, 'size': file.stat().st_size, 'sha256': digest(file)}
               for name, file in files_under(candidate).items()}
    removed = old.keys() - current.keys()
    delta_path = getattr(args, 'star_runtime_delta', None)
    candidate_manifest = getattr(args, 'candidate_manifest', None)
    if bool(delta_path) != bool(candidate_manifest):
        raise ValueError('Star delta requires both --star-runtime-delta and --candidate-manifest')
    component = validate_review(Path(delta_path).absolute(), baseline,
                                Path(candidate_manifest).absolute(), candidate) if delta_path else None
    approved = {row['path'] for row in component['files']} if component else set()
    if removed and not component:
        raise ValueError('This public updater does not delete files: review migrations first')
    changed = [row for name, row in sorted(current.items())
               if name not in old or row['sha256'] != old[name]['sha256']]
    denied = [row['path'] for row in changed if not public_payload(row['path']) and row['path'] not in approved]
    if denied:
        raise ValueError('Non-public changes require an explicit reviewed Star delta: ' + repr(denied))
    metadata = json.loads((candidate / 'fusion-install.json').read_bytes())
    version = metadata['version']
    assert re.fullmatch(r'\d+\.\d+\.\d+', version)
    name = f'XueBuTong-Update-{version}-win-x64'
    # Copy only the explicit changed allowlist into the compiler's input tree.
    for row in changed:
        target = work / 'candidate' / row['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(candidate / row['path'], target)
        assert digest(target) == row['sha256']
    for file in ('installer-file-checks.iss', 'installer-uninstall.iss', 'release-privacy-check.iss', 'release_privacy.py'):
        shutil.copy2(source / 'build' / file, work / file)
    # The partial payload intentionally omits Python. Run the same privacy gate
    # with the verified build-time interpreter; it is never added to [Files].
    gate = (work / 'release-privacy-check.iss').read_text('utf-8-sig')
    gate = gate.replace('AddBackslash(SourcePath) + "candidate\\python3144\\python.exe"',
                        '"' + str(deps / 'runtime/python3144/python.exe') + '"')
    (work / 'release-privacy-check.iss').write_text(gate, encoding='utf-8-sig')
    shutil.copytree(source / 'LICENSES', work / 'candidate/LICENSES', dirs_exist_ok=True)
    shutil.copy2(source / 'LICENSE', work / 'candidate/LICENSE')
    if any(row['path'] == 'ocs-lab/XueBuTong.exe' for row in changed):
        for notice in ('LICENSE.electron.txt', 'LICENSES.chromium.html'):
            target = work / 'candidate/ocs-lab' / notice
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(candidate / 'ocs-lab' / notice, target)
    # License notices are included in every public update, even if unchanged.
    for name_in_tree, file in files_under(work / 'candidate').items():
        if name_in_tree not in {row['path'] for row in changed}:
            changed.append({'path': name_in_tree, 'size': file.stat().st_size, 'sha256': digest(file)})
    shutil.copytree(deps / 'tools', work / 'build-tools')
    shutil.copy2(source / 'assets/fusion.ico', work / 'setup.ico')
    (work / 'release-docs').mkdir()
    component_note = ('\n包含星蝉 ' + component['toVersion'] + ' 运行组件更新。' if component
                      else '\n不包含或替换星蝉原版组件。')
    (work / 'release-docs/使用说明.txt').write_text(
        '学不通增量更新 ' + version + '\n\n仅适用于已安装的兼容版本，不是首次安装包。'
        + component_note + '账号、登录数据、队列和日志保留。'
        '\n请先退出学不通；安装前检查原版本并备份本次替换的程序文件。'
        '\n项目地址：https://github.com/A3697/XueBuTong\n', encoding='utf-8-sig')
    files = []
    guards = []
    backups = []
    deletes = []
    for row in changed:
        relative = row['path'].replace('/', '\\')
        parent = str(Path(relative).parent)
        flags = 'ignoreversion uninsneveruninstall' if relative == 'fusion-install.json' else 'ignoreversion'
        files.append(f'Source: "candidate\\{relative}"; DestDir: "{{app}}\\{parent}"; Hash: "{row["sha256"]}"; Flags: {flags}')
        # Different existing modified code is not silently overwritten.
        old_hash = old.get(row['path'], {}).get('sha256', '')
        guards.append(f"  if not CheckUpdateFile('{quote(relative)}', '{old_hash}', '{row['sha256']}') then begin Result := '程序文件与兼容版本不符，请使用完整安装包更新。'; Exit; end;")
        backups.append(f"  BackupUpdateFile('{quote(relative)}');")
    for deleted in sorted(removed):
        relative = deleted.replace('/', '\\')
        guards.append(f"  if not CheckRemovedUpdateFile('{quote(relative)}', '{old[deleted]['sha256']}') then begin Result := '失效程序文件与兼容版本不符，请使用完整安装包更新。'; Exit; end;")
        backups.append(f"  BackupUpdateFile('{quote(relative)}');")
        deletes.append(f'Type: files; Name: "{{app}}\\{relative}"')
    if component:
        # Check every retained Star component file as well as the changed ones.
        # A prepared-manifest hash alone does not prove its files are intact.
        changed_names = {row['path'] for row in changed}
        for filename, row in sorted(current.items()):
            if not allowed_path(filename) or filename in changed_names:
                continue
            relative = filename.replace('/', '\\')
            guards.append(f"  if not CheckUpdateFile('{quote(relative)}', '{old.get(filename, {}).get('sha256', '')}', '{row['sha256']}') then begin Result := '星蝉组件不完整或已修改，请使用完整安装包修复。'; Exit; end;")
    (work / 'installer-files.iss').write_text('\n'.join(files) + '\n', encoding='utf-8-sig')
    _, privacy = require_clean(work / 'candidate')
    (work / 'release-manifest.json').write_text(json.dumps({'files': changed}), encoding='utf-8')
    (work / 'privacy-verification.json').write_text(json.dumps(privacy), encoding='utf-8')
    text = (source / 'build/installer.iss').read_text('utf-8-sig')
    text = re.sub(r'^OutputBaseFilename=.*$', 'OutputBaseFilename=' + name, text, flags=re.M)
    text = re.sub(r'^VersionInfoOriginalFileName=.*$', 'VersionInfoOriginalFileName=' + name + '.exe', text, flags=re.M)
    text = text.replace('SetupIconFile=candidate\\assets\\fusion.ico', 'SetupIconFile=setup.ico')
    # Never inherit the full installer's legacy cleanup. Only reviewed exact
    # Star removals may be deleted; no wildcards, directories or user data.
    delete_section = '[InstallDelete]\n' + '\n'.join(deletes) + '\n' if deletes else ''
    text = re.sub(r'\[InstallDelete\][\s\S]*?(?=\[Icons\])', lambda _: delete_section, text)
    text = text.replace('DisableDirPage=no', 'DisableDirPage=yes')
    support = r"""
var UpdateBackup: String;
function UpdateAttributes(Filename: String): Cardinal;
  external 'GetFileAttributesW@kernel32.dll stdcall';
function UpdatePathSafe(Filename: String): Boolean;
var Parent: String; Attributes: Cardinal;
begin
  Result := False;
  Filename := RemoveBackslashUnlessRoot(ExpandFileName(Filename));
  repeat
    Attributes := UpdateAttributes(Filename);
    if (Attributes <> $FFFFFFFF) and ((Attributes and $400) <> 0) then Exit;
    Parent := ExtractFileDir(Filename);
    if CompareText(Parent, Filename) = 0 then Break;
    Filename := Parent;
  until False;
  Result := True;
end;
function UpdateProcessesStopped: Boolean;
var Service, Processes, Process: Variant; I: Integer; Filename, Prefix: String;
begin
  Result := False;
  Prefix := Lowercase(AddBackslash(ExpandFileName(WizardDirValue)));
  try
    Service := CreateOleObject('WbemScripting.SWbemLocator');
    Service := Service.ConnectServer('', 'root\CIMV2');
    Processes := Service.ExecQuery('SELECT ExecutablePath FROM Win32_Process WHERE Name = ''XueBuTong.exe'' OR Name = ''学不通.exe'' OR Name = ''python.exe'' OR Name = ''chrome.exe''');
    for I := 0 to Processes.Count - 1 do begin
      Process := Processes.ItemIndex(I);
      if not VarIsNull(Process.ExecutablePath) then begin
        Filename := Process.ExecutablePath;
        Filename := Lowercase(Filename);
        if Pos(Prefix, Filename) = 1 then Exit;
      end;
    end;
    Result := True;
  except Result := False; end;
end;
function UpdateOpenProcess(Access: Cardinal; Inherit: Boolean; Pid: Cardinal): THandle;
  external 'OpenProcess@kernel32.dll stdcall';
function UpdateWait(Handle: THandle; Milliseconds: Cardinal): Cardinal;
  external 'WaitForSingleObject@kernel32.dll stdcall';
function UpdateCloseHandle(Handle: THandle): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';
function WaitForOldHost: Boolean;
var Pid, I: Integer; Handle: THandle;
begin
  Result := True;
  Pid := StrToIntDef(ExpandConstant('{param:WAITFORPID|0}'), 0);
  if Pid <= 0 then Exit;
  Handle := UpdateOpenProcess($100000, False, Pid);
  if Handle = 0 then Exit;
  Result := False;
  try
    for I := 1 to 900 do
      if UpdateWait(Handle, 100) = 0 then begin Result := True; Break; end;
  finally UpdateCloseHandle(Handle); end;
end;

function CheckUpdateFile(Relative, PreviousHash, NewHash: String): Boolean;
var Filename: String; Hash: String;
begin
  Filename := AddBackslash(WizardDirValue) + Relative;
  Result := False;
  if not UpdatePathSafe(Filename) then Exit;
  if not FileExists(Filename) then begin Result := PreviousHash = ''; Exit; end;
  Hash := Lowercase(GetSHA256OfFile(Filename));
  Result := (Hash = PreviousHash) or (Hash = NewHash);
end;

function CheckRemovedUpdateFile(Relative, PreviousHash: String): Boolean;
var Filename: String;
begin
  Filename := AddBackslash(WizardDirValue) + Relative;
  Result := False;
  if not UpdatePathSafe(Filename) or DirExists(Filename) then Exit;
  if not FileExists(Filename) then begin Result := True; Exit; end;
  Result := Lowercase(GetSHA256OfFile(Filename)) = PreviousHash;
end;

procedure BackupUpdateFile(Relative: String);
var SourceFile, Destination: String;
begin
  SourceFile := AddBackslash(WizardDirValue) + Relative;
  Destination := AddBackslash(UpdateBackup) + Relative;
  if FileExists(SourceFile) then begin
    if not ForceDirectories(ExtractFileDir(Destination)) or
       not FileCopy(SourceFile, Destination, False) or
       (GetSHA256OfFile(SourceFile) <> GetSHA256OfFile(Destination)) then
      RaiseException('更新备份失败，尚未替换程序文件。');
  end;
end;
"""
    text = text.replace('function InitializeSetup: Boolean;', support + '\nfunction InitializeSetup: Boolean;')
    text = text.replace('var RequestedDir: String;\nbegin\n  Result := True;',
                        "var RequestedDir: String;\nbegin\n  Result := WaitForOldHost;\n  if not Result then begin SuppressibleMsgBox('学不通仍未退出，更新已取消。', mbError, MB_OK, IDOK); Exit; end;")
    marker = "  Result := '';\n  try\n    if not HasProductDirectoryName"
    assert marker in text
    # Metadata and the protected-runtime manifest fix the base compatibility.
    baseline_hash = old['fusion-install.json']['sha256']
    backend_hash = old[BACKEND_MANIFEST]['sha256']
    new_backend_hash = current[BACKEND_MANIFEST]['sha256'] if component else backend_hash
    gate = f"""  Result := '';
  if not IsOwnedProgramDirectory(WizardDirValue) then begin Result := '此更新需要已经安装的学不通。'; Exit; end;
  if not UpdateProcessesStopped then begin Result := '请先退出此目录中的学不通及账号任务，再重试更新。'; Exit; end;
  if not CheckUpdateFile('fusion-install.json', '{baseline_hash}', '{current['fusion-install.json']['sha256']}') or
     not CheckUpdateFile('star-runtime\\_backend-prepared-manifest.json', '{backend_hash}', '{new_backend_hash}') then begin Result := '当前安装不属于此增量包支持的版本。'; Exit; end;
{chr(10).join(guards)}
  Log('Compatible update verified; preparing changed-file backup.');
  UpdateBackup := AddBackslash(WizardDirValue) + 'updates\\backup-{version}-' + GetDateTimeString('yyyymmdd-hhnnss-zzz', #0, #0);
  try
    if not UpdatePathSafe(UpdateBackup) then RaiseException('更新目录不能是链接');
    if not ForceDirectories(UpdateBackup) then RaiseException('无法创建更新备份目录');
{chr(10).join(backups)}
  except Result := GetExceptionMessage; Exit; end;
  try
    if not HasProductDirectoryName"""
    text = text.replace(marker, gate)
    (work / 'installer.iss').write_text(text, encoding='utf-8-sig')
    output.mkdir(parents=True, exist_ok=True)
    package = output / (name + '.exe')
    if package.exists():
        raise ValueError('Refusing to overwrite a published update')
    if getattr(args, 'prepare_only', False):
        plan = {'version': version, 'prepared': True, 'compiled': False,
                'closedComponentsIncluded': bool(component), 'files': changed,
                'removedFiles': [old[value] for value in sorted(removed)]}
        if component:
            plan['starRuntimeDelta'] = component
        (work / 'update-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
        return plan
    with (work / 'compile.log').open('w', encoding='utf-8') as log:
        subprocess.run([str(work / 'build-tools/InnoSetup/ISCC.exe'), '/Q', '/O' + str(output),
                        str(work / 'installer.iss')], cwd=work, stdout=log, stderr=subprocess.STDOUT, check=True)
    report = {'version': version, 'passed': True, 'closedComponentsIncluded': bool(component),
              'requiresExistingInstall': True, 'package': package.name, 'sha256': digest(package),
              'size': package.stat().st_size, 'files': changed,
              'removedFiles': [old[name] for name in sorted(removed)],
              'compatibleBase': {'version': json.loads(baseline.read_text('utf-8-sig'))['version'],
                                 'metadataSha256': old['fusion-install.json']['sha256'],
                                 'backendManifestSha256': old[BACKEND_MANIFEST]['sha256']}}
    if component:
        report['starRuntimeDelta'] = {key: component[key] for key in ('fromVersion', 'toVersion', 'baselineManifestSha256', 'candidateManifestSha256')}
        report['starRuntimeDelta']['reviewSha256'] = digest(Path(delta_path))
    (output / (name + '.manifest.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for option in ('source', 'candidate', 'baseline', 'work', 'dependencies', 'output'):
        parser.add_argument('--' + option, required=True)
    parser.add_argument('--star-runtime-delta', help='Explicit reviewed Star runtime/frontend delta; default never includes closed components')
    parser.add_argument('--candidate-manifest', help='Complete reviewed candidate manifest bound by --star-runtime-delta')
    parser.add_argument('--prepare-only', action='store_true', help='Write validated compiler inputs and update-plan.json without compiling or installing')
    build_update(parser.parse_args())
