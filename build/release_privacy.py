"""Fail-closed release privacy gate; never reads or edits installed user data."""
from pathlib import Path, PurePosixPath
import argparse
import base64
import hashlib
import io
import json
import marshal
import re
import stat
import struct
import types
import urllib.parse
import zipfile
import zlib

POLICY_VERSION = 1
STATE_DIRS = frozenset({
    'logs', 'ocs-profile', 'instances', 'private', 'evidence', 'lab-logs',
    'bridge-data', 'recovery', 'userdata', 'user-data', 'user_data',
    'userdatadirs', 'profiles', 'browser-profile', 'browser_profiles',
    'cache', 'cache2', 'code cache', 'gpucache', 'shadercache', '__pycache__',
    'session storage', 'local storage', 'indexeddb', 'sessions',
})
STATE_NAMES = frozenset({'cookies', 'history', 'login data', 'local state', 'web data', 'visited links', '.env'})
STATE_SUFFIXES = frozenset({'.log', '.sqlite', '.sqlite3', '.db', '.db3', '.ldb', '.sst', '.har', '.dmp'})
UNSUPPORTED_ARCHIVES = frozenset({'.7z', '.rar', '.gz', '.bz2', '.xz', '.tar', '.tgz', '.zst', '.asar'})
PRIVATE_KEYS = frozenset({
    'password', 'passwd', 'api_key', 'apikey', 'access_token', 'refresh_token',
    'id_token', 'sessionid', 'session_id', 'auth.session', 'ua.device_id',
    'device_id', 'source_root', 'token', 'yanxitoken', 'aikey',
    'xingchanbankkey', 'session_token', 'authorization', 'cookie',
})
SECRET = re.compile(rb'(?:sk-proj-|sk-ant-)[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n){2,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
MAX_ARCHIVE_BYTES = 2 * 1024**3
MAX_MEMBER_BYTES = 256 * 1024**2


def unsupported_archive(data):
    return data.startswith((b'7z\xbc\xaf\x27\x1c', b'Rar!\x1a\x07', b'\x1f\x8b\x08', b'BZh', b'\xfd7zXZ\0', b'\x28\xb5\x2f\xfd')) or len(data) >= 262 and data[257:262] == b'ustar'


def looks_json(data):
    head = data[:64].lstrip(b' \t\r\n')
    return head.startswith((b'{', b'[', b'\xef\xbb\xbf', b'\xff\xfe', b'\xfe\xff', b'\x00\x00\xfe\xff', b'\x00{', b'\x00['))


class PrivacyError(ValueError):
    pass


def state_path(value):
    """Match data paths, never source modules named log.pyc/cookies.js."""
    path = PurePosixPath(str(value).replace('\\', '/'))
    parts = tuple(part.casefold() for part in path.parts)
    if path.is_absolute() or '..' in parts or any(':' in part for part in parts):
        return True
    if any(part in STATE_DIRS for part in parts[:-1]):
        return True
    if len(parts) >= 2 and (parts[:2] == ('star-runtime', 'storage') or parts[:1] == ('storage',)):
        return True
    name = parts[-1] if parts else ''
    return name in STATE_NAMES or path.suffix.casefold() in STATE_SUFFIXES or name.endswith(('.db-wal', '.db-shm', '.sqlite-wal', '.sqlite-shm'))


def private_scalar(value):
    if not isinstance(value, str) or not value.strip():
        return False
    text = value.strip()
    return not (text.startswith('${') or text.casefold() in {'example', 'changeme', 'your_token', 'your_api_key', 'your_password', 'placeholder'} or text.startswith('<') and text.endswith('>'))


class Scanner:
    def __init__(self, known_values=()):
        self.values = {str(value) for value in known_values if value is not None and len(str(value)) >= 2}
        patterns = set()
        for value in self.values:
            patterns.update(value.encode(encoding) for encoding in ('utf-8', 'utf-16-le', 'utf-16-be', 'utf-32-le', 'utf-32-be'))
            patterns.add(json.dumps(value, ensure_ascii=True)[1:-1].encode('ascii'))
            patterns.add(urllib.parse.quote(value, safe='').encode('ascii'))
            if len(value) >= 5:
                patterns.add(base64.b64encode(value.encode('utf-8')))
        self.patterns = tuple(patterns)
        self.overlap = max([65557] + [len(pattern) for pattern in self.patterns])
        self.findings = set()
        self.files = []
        self.archive_members = 0
        self.expanded_bytes = 0

    def finding(self, label, kind):
        for value in sorted(self.values, key=len, reverse=True):
            label = label.replace(value, '[redacted]')
        self.findings.add((label, kind))

    def content(self, data, label):
        if self.patterns and any(pattern in data for pattern in self.patterns):
            self.finding(label, 'known-personal-value')
        if SECRET.search(data):
            self.finding(label, 'private-key-or-secret')

    def json_values(self, value, label, parents=()):
        if isinstance(value, dict):
            for key, item in value.items():
                dependency = (PurePosixPath(label).name == 'package.json' and parents in {
                    ('dependencies',), ('devDependencies',), ('peerDependencies',), ('optionalDependencies',)
                } and isinstance(item, str) and re.fullmatch(r'[~^<>= ]*\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?', item))
                if not dependency and str(key).casefold() in PRIVATE_KEYS and private_scalar(item):
                    self.finding(label, 'populated-private-state')
                self.json_values(item, label, parents + (str(key),))
        elif isinstance(value, list):
            for item in value:
                self.json_values(item, label, parents)

    def inspect_json(self, data, label, required=False):
        if required or looks_json(data):
            try:
                self.json_values(json.loads(data), label)
            except (UnicodeDecodeError, json.JSONDecodeError):
                if required:
                    self.finding(label, 'unreadable-json')

    def member(self, data, name, label, depth):
        self.archive_members += 1
        self.expanded_bytes += len(data)
        if self.expanded_bytes > MAX_ARCHIVE_BYTES or depth > 5:
            raise PrivacyError('Archive inspection limit exceeded; release blocked.')
        if state_path(name):
            self.finding(label, 'runtime-data-member')
        self.content(str(name).encode('utf-8'), label)
        self.content(data, label)
        self.inspect_json(data, label, str(name).casefold().endswith('.json'))
        self.archives(data, name, label, depth)

    def archives(self, data, name, label, depth=0):
        suffix = PurePosixPath(str(name).replace('\\', '/')).suffix.casefold()
        if suffix in UNSUPPORTED_ARCHIVES or unsupported_archive(data):
            raise PrivacyError('Unsupported archive format; release blocked.')
        if suffix == '.zip' or data.startswith((b'PK\x03\x04', b'PK\x05\x06')) or zipfile.is_zipfile(io.BytesIO(data)):
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    for item in archive.infolist():
                        if item.is_dir():
                            if state_path(item.filename.rstrip('/') + '/placeholder'):
                                self.finding(label + '!' + item.filename, 'runtime-data-member')
                            continue
                        child_label = label + '!' + item.filename
                        if item.file_size > MAX_MEMBER_BYTES or item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16):
                            raise PrivacyError('Unsupported/encrypted archive member; release blocked.')
                        self.member(archive.read(item), item.filename, child_label, depth + 1)
            except (zipfile.BadZipFile, RuntimeError, NotImplementedError, zlib.error) as error:
                raise PrivacyError('Archive could not be inspected; release blocked.') from error
        elif suffix == '.pyz' or data.startswith(b'PYZ\0'):
            if not data.startswith(b'PYZ\0') or len(data) < 12:
                raise PrivacyError('Unsupported PYZ container; release blocked.')
            offset = struct.unpack('>I', data[8:12])[0]
            if not 12 <= offset < len(data):
                raise PrivacyError('Invalid PYZ index; release blocked.')
            try:
                toc = marshal.loads(data[offset:])
                items = toc.items() if isinstance(toc, dict) else toc
                for module, location in items:
                    kind, start, size = location
                    if kind == 3 and size == 0:
                        continue
                    if not (isinstance(module, str) and 12 <= start <= start + size <= offset):
                        raise PrivacyError('Invalid PYZ member; release blocked.')
                    decompressor = zlib.decompressobj()
                    plain = decompressor.decompress(data[start:start + size], MAX_MEMBER_BYTES + 1)
                    if len(plain) > MAX_MEMBER_BYTES or not decompressor.eof:
                        raise PrivacyError('Oversize/incomplete PYZ member; release blocked.')
                    member_name = module.replace('.', '/') + ('.pyc' if kind in (0, 1) else '')
                    self.member(plain, member_name, label + '!' + module, depth + 1)
                    if self.values and kind in (0, 1):
                        self.code_values(marshal.loads(plain), label + '!' + module)
            except (ValueError, TypeError, EOFError, zlib.error, struct.error) as error:
                raise PrivacyError('PYZ could not be inspected; release blocked.') from error

    def code_values(self, code, label):
        if isinstance(code, types.CodeType):
            for value in code.co_consts:
                if isinstance(value, (str, int)) and str(value) in self.values:
                    self.finding(label, 'known-personal-code-constant')
                elif isinstance(value, types.CodeType):
                    self.code_values(value, label)

    def tree(self, root):
        root = Path(root).resolve()
        for path in sorted(root.rglob('*')):
            if path.is_symlink() or path.is_junction() or not path.resolve().is_relative_to(root):
                raise PrivacyError('Release contains a reparse point; build blocked.')
            rel = path.relative_to(root).as_posix()
            if path.is_dir():
                if state_path(rel + '/placeholder'):
                    self.finding(rel, 'runtime-data-directory')
                continue
            if not path.is_file():
                raise PrivacyError('Unsupported release entry; build blocked.')
            if state_path(rel):
                self.finding(rel, 'runtime-data-file')
            self.content(rel.encode('utf-8'), rel)
            digest = hashlib.sha256()
            tail = b''
            head = b''
            with path.open('rb') as stream:
                while block := stream.read(1024 * 1024):
                    if not head:
                        head = block[:512]
                    digest.update(block)
                    self.content(tail + block, rel)
                    tail = (tail + block)[-self.overlap:]
            self.files.append({'path': rel, 'size': path.stat().st_size, 'sha256': digest.hexdigest()})
            suffix = path.suffix.casefold()
            if suffix in UNSUPPORTED_ARCHIVES or unsupported_archive(head):
                raise PrivacyError('Unsupported archive format; release blocked.')
            container = suffix in {'.zip', '.pyz'} or head.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PYZ\0')) or b'PK\x05\x06' in tail and zipfile.is_zipfile(path)
            if container or suffix == '.json' or looks_json(head):
                if path.stat().st_size > MAX_MEMBER_BYTES:
                    raise PrivacyError('Container inspection limit exceeded; build blocked.')
                data = path.read_bytes()
                self.inspect_json(data, rel, suffix == '.json')
                if container:
                    self.archives(data, rel, rel)
        return self.report()

    def report(self):
        return {'policyVersion': POLICY_VERSION, 'fileCount': len(self.files), 'bytesScanned': sum(item['size'] for item in self.files),
                'archiveMembersScanned': self.archive_members, 'archiveExpandedBytes': self.expanded_bytes,
                'knownValuesSupplied': len(self.values), 'findings': [{'path': label, 'rule': kind} for label, kind in sorted(self.findings)],
                'passed': not self.findings}


def require_clean(root, manifest_path=None, known_values=()):
    scanner = Scanner(known_values)
    result = scanner.tree(root)
    if not result['passed']:
        raise PrivacyError('Release privacy check failed: ' + json.dumps(result['findings'], ensure_ascii=True))
    if manifest_path is not None:
        manifest = json.loads(Path(manifest_path).read_text(encoding='utf-8-sig'))
        expected = {entry['path']: (entry['size'], entry['sha256']) for entry in manifest['files']}
        actual = {entry['path']: (entry['size'], entry['sha256']) for entry in scanner.files}
        if expected != actual:
            raise PrivacyError('Reviewed release manifest differs from candidate; build blocked.')
    return scanner, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent / 'candidate')
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--quiet', action='store_true')
    args = parser.parse_args()
    try:
        _, result = require_clean(args.root, args.manifest)
    except (PrivacyError, OSError, ValueError, zipfile.BadZipFile) as error:
        print(str(error))
        return 2
    if not args.quiet:
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
