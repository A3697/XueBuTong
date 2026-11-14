"""Machine-only helper: the parent controller must capture stdout, which contains a secret."""
from pathlib import Path
import json
import sys


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print('runtime_info_failed: expected one integration token file', file=sys.stderr)
        return 2
    # Embedded Python's isolated _pth omits this tools directory by default.
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from run_integrated_backend import read_runtime_info
        payload = read_runtime_info(args[0])
        sys.stdout.write(json.dumps(payload, ensure_ascii=True, separators=(',', ':')) + '\n')
        sys.stdout.flush()
        return 0
    except BaseException:
        # Never echo a supplied path, decrypted secret, exception object or traceback.
        print('runtime_info_failed: encrypted integration token unavailable or invalid', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
