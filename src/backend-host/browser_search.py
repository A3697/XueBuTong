"""One stateless provider query. No login, course engine or shared account store."""
import contextlib
import io
import json
import logging
import os
from pathlib import Path
import sys
import tempfile


def main():
    root = Path(__file__).resolve().parent.parent
    runtime = root / 'star-runtime'
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(runtime))
    sys.path.insert(0, str(root / 'src'))
    sys.path.insert(0, str(root / 'tools'))
    manifest = json.loads((runtime / '_backend-prepared-manifest.json').read_text(encoding='utf-8'))
    directories = {runtime}
    for entry in manifest['files']:
        relative = Path(entry['path'])
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('invalid_runtime_path')
        if relative.suffix.lower() in ('.dll', '.pyd'):
            directories.add((runtime / relative).parent)
    dll_handles = [os.add_dll_directory(str(p)) for p in sorted(directories)]
    from network_policy import install_direct_network
    install_direct_network()
    # Providers receive store=None and cache=None; each request owns its Session.
    with tempfile.TemporaryDirectory(prefix='xbt-query-') as temporary:
        with contextlib.chdir(temporary), contextlib.redirect_stdout(io.StringIO()):
            import core.paths
            core.paths.user_data_dir = lambda: Path(temporary)
            try:
                from original_search_bridge import OriginalSearchService, install_short_answer_prompt
                install_short_answer_prompt()
                request = json.loads(sys.stdin.buffer.read(1024 * 1024 + 1))
                result = OriginalSearchService().query(request['source'], request['payload'])
            finally:
                # Upstream loggers may open files while importing a provider.
                # Close them before removing this request's private scratch tree.
                logging.shutdown()
    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Never return provider payloads, credentials, URLs or tracebacks.
        sys.stdout.write(json.dumps({'error': 'original_provider_query_failed'}))
        sys.exit(1)
