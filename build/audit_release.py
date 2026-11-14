"""Validate clean release input and regenerate the reviewed file manifest."""
from pathlib import Path
import hashlib
import json
import re
from release_privacy import require_clean
from executable_identity import verify_identity

HERE = Path(__file__).resolve().parent
ROOT = HERE / 'candidate'


def audit():
    scanner, privacy = require_clean(ROOT)
    runtime = ROOT / 'star-runtime'
    backend = json.loads((runtime / '_backend-prepared-manifest.json').read_text(encoding='utf-8-sig'))
    expected = {entry['path'] for entry in backend['files']}
    actual = {path.relative_to(runtime).as_posix() for path in runtime.rglob('*') if path.is_file()}
    if actual != expected | {'_backend-prepared-manifest.json'}:
        raise ValueError('Unexpected or missing backend release files; build blocked.')
    for entry in backend['files']:
        path = runtime / entry['path']
        if path.stat().st_size != entry['size'] or hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() != entry['sha256']:
            raise ValueError('Backend asset changed without a reviewed manifest; build blocked.')
    python_sources = []
    for path in list((ROOT / 'src').glob('*.py')) + list((ROOT / 'tools').glob('*.py')):
        compile(path.read_text(encoding='utf-8-sig'), str(path), 'exec')
        python_sources.append(path.name)
    metadata = json.loads((ROOT / 'fusion-install.json').read_text(encoding='utf-8-sig'))
    script_file = ROOT / 'assets/defaults/ocs.user.js'
    script_meta = json.loads((ROOT / 'assets/defaults/ocs-script.json').read_text(encoding='utf-8-sig'))
    script_header = re.search(r'^//\s*@version\s+(\S+)', script_file.read_text(encoding='utf-8-sig'), re.MULTILINE)
    script_version = script_header.group(1) if script_header else ''
    if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', script_version):
        raise ValueError('内置 OCS 网页脚本版本不符合 SemVer，打包已停止。')
    if script_version != script_meta['metadata']['version'] or script_version != metadata['dependencies']['ocsScript']:
        raise ValueError('网页脚本、脚本清单与产品依赖版本不一致，打包已停止。')
    if hashlib.file_digest(script_file.open('rb'), 'sha256').hexdigest() != script_meta['sha256']:
        raise ValueError('内置网页脚本摘要不匹配，打包已停止。')
    identity = {name: verify_identity(ROOT / name, metadata['version'])
                for name in ('学不通.exe', 'ocs-lab/XueBuTong.exe')}
    if (ROOT / 'ocs-lab/OCS Desktop.exe').exists():
        raise ValueError('旧内部主程序仍在安装载荷中；打包已停止。')
    report = {'version': metadata['version'], 'build': metadata['build'], 'files': scanner.files,
              'fileCount': len(scanner.files), 'totalBytes': sum(entry['size'] for entry in scanner.files),
              'privacy': privacy, 'runtimeFilesVerified': len(backend['files']),
              'pythonSourceParsed': python_sources, 'executableIdentity': identity, 'userscriptVersion': script_version, 'passed': True}
    (HERE / 'release-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in report.items() if key != 'files'}, ensure_ascii=False))


if __name__ == '__main__':
    audit()
