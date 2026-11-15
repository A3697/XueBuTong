"""Reconstruct the reviewed 2.5.11 baseline and compile its offline installer.

Never launches the application or installer, downloads dependencies, edits the
source/dependency trees, or accepts an unreviewed payload by refreshing hashes.
"""
from pathlib import Path, PurePosixPath
import argparse
import contextlib
import hashlib
import json
import os
import re
import runpy
import shutil
import stat
import subprocess
import sys
import time

BUILD_FILES = ('Launcher.cs', 'installer.iss', 'installer-file-checks.iss',
               'installer-uninstall.iss', 'release-privacy-check.iss',
               'audit_release.py', 'release_privacy.py', 'generate_installer_files.py',
               'executable_identity.py')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def absolute(path):
    return Path(os.path.abspath(path))


def no_links(path):
    """Inspect before resolve; resolving first would hide a junction/symlink."""
    for current in (path, *path.parents):
        try:
            attributes = getattr(current.lstat(), 'st_file_attributes', 0)
        except FileNotFoundError:
            continue
        if current.is_symlink() or attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
            raise ValueError('不允许符号链接、目录联接或其他重解析点：' + str(current))


def files_under(root):
    no_links(root)
    if not root.is_dir():
        raise ValueError('缺少目录：' + str(root))
    found = {}
    for directory, folders, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        for name in (*folders, *names):
            no_links(parent / name)
        for name in names:
            path = parent / name
            if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
                raise ValueError('不支持的文件类型或路径越界：' + str(path))
            found[path.relative_to(root).as_posix()] = path
    return found


def manifest_entries(path):
    value = json.loads(path.read_text(encoding='utf-8-sig'))
    rows = value.get('files') if isinstance(value, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError('文件清单必须包含非空 files 数组：' + str(path))
    entries, folded = {}, set()
    for row in rows:
        name = row.get('path') if isinstance(row, dict) else None
        if not isinstance(name, str) or '\\' in name or ':' in name:
            raise ValueError('文件清单路径无效')
        pure = PurePosixPath(name)
        if pure.is_absolute() or not pure.parts or '..' in pure.parts or pure.as_posix() != name:
            raise ValueError('文件清单含越界或非规范路径：' + name)
        size, sha = row.get('size'), row.get('sha256')
        if type(size) is not int or size < 0 or not isinstance(sha, str) or not re.fullmatch('[0-9a-f]{64}', sha):
            raise ValueError('文件清单大小或摘要无效：' + name)
        if name.casefold() in folded:
            raise ValueError('文件清单存在重复路径：' + name)
        entries[name] = (size, sha)
        folded.add(name.casefold())
    return entries


def verify_tree(root, manifest, *, exclude=()):
    expected = manifest_entries(manifest)
    actual = {name: file for name, file in files_under(root).items() if name not in exclude}
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))[:8]
        extra = sorted(set(actual) - set(expected))[:8]
        raise ValueError('文件清单不匹配；缺少 ' + repr(missing) + '；新增 ' + repr(extra))
    for name, (size, sha) in expected.items():
        file = actual[name]
        if file.stat().st_size != size or digest(file) != sha:
            raise ValueError('文件已改变：' + name)
    return len(expected)


def claim_empty(path):
    no_links(path)
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ValueError('工作目录必须是新目录或空目录，不会清空已有内容：' + str(path))
    path.mkdir(parents=True, exist_ok=True)


def build(args):
    source, deps, work, output = map(absolute, (args.source_root, args.dependency_root, args.work_root, args.output_root))
    roots = (source, deps, work, output)
    for path in roots:
        no_links(path)
    for index, left in enumerate(roots):
        for right in roots[index+1:]:
            if left.is_relative_to(right) or right.is_relative_to(left):
                raise ValueError('源码、依赖、工作和输出目录必须分开，不能相互包含。')
    if source != absolute(Path(__file__).parent.parent):
        raise ValueError('source-root 必须是此脚本所属源码目录。')
    if sys.version_info[:3] != (3, 14, 4):
        raise ValueError('必须使用离线依赖内的 Python 3.14.4，请通过 build.ps1 构建。')
    claim_empty(work)
    report = {'schema': 1, 'version': '2.5.11', 'status': 'running', 'stages': [],
              'sourceRoot': str(source), 'dependencyRoot': str(deps), 'workRoot': str(work),
              'outputRoot': str(output), 'applicationStarted': False, 'installerExecuted': False,
              'networkUsed': False, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    started = time.monotonic()

    def record(stage, **values):
        item = {'stage': stage, 'elapsedSeconds': round(time.monotonic() - started, 3), **values}
        report['stages'].append(item)
        with (work/'build-log.jsonl').open('a', encoding='utf-8') as stream:
            stream.write(json.dumps(item, ensure_ascii=False) + '\n')
        print(json.dumps(item, ensure_ascii=False), flush=True)

    try:
        count = verify_tree(source, source/'source-manifest.json', exclude=('source-manifest.json',))
        record('source-manifest', files=count)
        count = verify_tree(deps, deps/'dependency-manifest.json', exclude=('dependency-manifest.json',))
        record('dependency-manifest', files=count)
        provenance = json.loads((source/'build/dependency-provenance.json').read_text(encoding='utf-8-sig'))
        if digest(source/'build/Launcher.cs') != provenance['launcherSourceSha256'] or digest(deps/'runtime/学不通.exe') != provenance['launcherBinarySha256']:
            raise ValueError('启动器源代码与预编译文件的来源摘要不匹配。')
        metadata = json.loads((source/'fusion-install.json').read_text(encoding='utf-8-sig'))
        if (metadata['version'] != '2.5.11' or provenance['pythonVersion'] != '3.14.4'
                or metadata['dependencies']['ocs'] != provenance['ocsVersion']
                or metadata['dependencies']['xingchan'] != provenance['xingchanVersion']):
            raise ValueError('组件版本与发布基线不匹配。')
        record('component-provenance', python='3.14.4', ocs=provenance['ocsVersion'], xingchan=provenance['xingchanVersion'])

        candidate = work/'candidate'
        if (source/'src/ocs-app/node_modules').exists() or (source/'src/ocs-app/xingchan-lab-bootstrap.cjs').exists():
            raise ValueError('源码目录不应重复包含 node_modules 或生成的 OCS bootstrap。')
        shutil.copytree(deps/'runtime', candidate)
        for src, target in (('src/fusion', 'src'), ('src/backend-host', 'tools'),
                            ('src/star-panel', 'star-runtime/web/dist'), ('src/ocs-app', 'ocs-lab/resources/app'),
                            ('assets', 'assets')):
            shutil.copytree(source/src, candidate/target, dirs_exist_ok=True)
        shutil.copy2(source/'fusion-install.json', candidate/'fusion-install.json')
        shutil.copy2(source/'LICENSE', candidate/'LICENSE')
        shutil.copytree(source/'LICENSES', candidate/'LICENSES', dirs_exist_ok=True)
        shutil.copy2(source/'src/fusion/electron-bootstrap.cjs', candidate/'ocs-lab/resources/app/xingchan-lab-bootstrap.cjs')
        for name in BUILD_FILES:
            shutil.copy2(source/'build'/name, work/name)
        shutil.copy2(source/'build/release-input-manifest.json', work/'release-manifest.json')
        shutil.copytree(source/'docs', work/'release-docs')
        shutil.copytree(deps/'tools', work/'build-tools')
        record('stage', candidate=str(candidate))
        count = verify_tree(candidate, source/'build/release-input-manifest.json')
        record('exact-release-baseline', files=count)

        # Embedded ._pth and -I deliberately omit cwd. Add only reviewed local
        # build helpers, never depend on a machine-wide Python installation.
        sys.path.insert(0, str(work))
        for name in ('audit_release.py', 'generate_installer_files.py'):
            with (work/(name + '.log')).open('w', encoding='utf-8') as stream:
                with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
                    runpy.run_path(str(work/name), run_name='__main__')
            record(name, passed=True)
        verify_tree(candidate, source/'build/release-input-manifest.json')
        installer_source = (work/'installer.iss').read_text(encoding='utf-8-sig')
        match = re.search(r'^OutputBaseFilename=([A-Za-z0-9._-]+)\s*$', installer_source, re.MULTILINE)
        if not match:
            raise ValueError('无法确认安装包文件名。')
        output.mkdir(parents=True, exist_ok=True)
        installer = output/(match[1] + '.exe')
        output_report = output/(match[1] + '.build.json')
        if installer.exists() or output_report.exists():
            raise ValueError('输出安装包或构建报告已存在，请指定新的 OutputRoot，避免覆盖。')
        compiler = work/'build-tools/InnoSetup/ISCC.exe'
        command = [str(compiler), '/Q', '/O' + str(output), str(work/'installer.iss')]
        with (work/'compiler.log').open('w', encoding='utf-8') as stream:
            completed = subprocess.run(command, cwd=work, stdout=stream, stderr=subprocess.STDOUT, check=False)
        if completed.returncode != 0 or not installer.is_file():
            raise RuntimeError('安装包编译失败，请查看工作目录中的 compiler.log。')
        record('compile-installer', exitCode=completed.returncode, filename=installer.name)
        report.update(status='passed', installer=str(installer), installerBytes=installer.stat().st_size,
                      installerSha256=digest(installer), elapsedSeconds=round(time.monotonic() - started, 3),
                      sourceManifestSha256=digest(source/'source-manifest.json'),
                      dependencyManifestSha256=digest(deps/'dependency-manifest.json'),
                      releaseBaselineManifestSha256=digest(source/'build/release-input-manifest.json'))
        output_report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    except BaseException as error:
        report.update(status='failed', errorType=type(error).__name__, error=str(error), elapsedSeconds=round(time.monotonic() - started, 3))
        raise
    finally:
        (work/'build-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--dependency-root', type=Path, required=True)
    parser.add_argument('--work-root', type=Path, required=True)
    parser.add_argument('--output-root', type=Path, required=True)
    args = parser.parse_args()
    try:
        return build(args)
    except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        print(json.dumps({'status': 'failed', 'errorType': type(error).__name__, 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
