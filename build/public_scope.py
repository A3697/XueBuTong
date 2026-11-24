"""Explicit publication boundary. No runtime/user data or Xingchan assets."""
from pathlib import PurePosixPath

PUBLIC_DIRS = ('src/fusion/', 'src/backend-host/', 'src/native-helpers/', 'src/ocs-app/',
               'build/', 'assets/about/', 'assets/defaults/', 'LICENSES/')
PUBLIC_FILES = {'LICENSE', 'README.md', 'CONTEXT.md', '.gitignore', 'build.ps1',
                'fusion-install.json', 'assets/fusion.ico', 'assets/fusion.png',
                'assets/ocs-original.png', 'assets/product-links.json',
                'docs/开源与更新.md', 'docs/源码与构建说明.md', 'docs/第三方组件说明.md',
                'docs/2.5.10修复验收.md','docs/2.5.12修复验收.md','docs/2.5.13修复验收.md','docs/2.5.14修复验收.md'}
# These standalone modules were written for the fusion application, not copied
# from the protected application's frontend. The derived HTML/CSS/app remain local.
PUBLIC_PANEL = {'scroll-follow.js', 'task-state.js', 'course-filter.js',
                'course-completion.js', 'panel-layout.js', 'course-watch.js'}


def public_source(name):
    p = PurePosixPath(name)
    if p.as_posix() != name or p.is_absolute() or '..' in p.parts or ':' in name or '\\' in name:
        return False
    if any(part in ('node_modules', '__pycache__', '.git') for part in p.parts):
        return False
    # The compiled OCS frontend aggregates fonts/libraries without a complete
    # component notice inventory. Keep it in the private full build until that
    # inventory is reviewed; the original fusion UI modules remain public.
    if name.startswith('src/ocs-app/public/') and name != 'src/ocs-app/public/assets/index.c87a5b08.js':
        return False
    if name in PUBLIC_FILES or name.startswith('src/star-panel/') and p.name in PUBLIC_PANEL:
        return True
    return any(name.startswith(prefix) for prefix in PUBLIC_DIRS)


def public_payload(name):
    """Files eligible for a public update. Closed assets never cross this gate."""
    if name in ('学不通.exe', 'ocs-lab/XueBuTong.exe', 'fusion-install.json'):
        return True
    if name == 'LICENSE' or name.startswith('LICENSES/'):
        return public_source(name)
    mappings = [('src/', 'src/fusion/'), ('tools/', 'src/backend-host/'),
                ('ocs-lab/resources/app/', 'src/ocs-app/'), ('assets/', 'assets/')]
    for prefix, source in mappings:
        if name.startswith(prefix):
            suffix = name[len(prefix):]
            if prefix == 'tools/' and not suffix.endswith(('.py', '.ps1')):
                return False
            return public_source(source + suffix)
    return False
