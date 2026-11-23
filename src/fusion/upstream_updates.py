"""Keep the bundled Xingchan version service local to this fusion release.

Install before importing the original server modules. The original class and
dataclass identities stay intact, while update I/O, cached termination markers,
and periodic upstream checks are replaced by local component information.
"""
from dataclasses import fields
import importlib
from pathlib import Path
import sys
import time


DISABLED_MESSAGE = '原组件联网更新已关闭，请使用学不通安装包更新。'
LOCAL_SOURCE = 'fusion-local'


def install_disabled_updates():
    """Disable the observed core.version entry points in this process only."""
    version = importlib.import_module('core.version')
    installed = getattr(version, '_fusion_disabled_updates', None)
    if installed is not None:
        return dict(installed)

    required = ('VersionChecker', 'CheckResult', 'CloudInfo', 'VersionState',
                'fetch_cloud_info', '_read_source', 'hourly_loop',
                'VERSION', 'DEFAULT_STATE_PATH', 'DEFAULT_LOG_PATH',
                'VersionNetworkError', 'get_logger')
    if any(not hasattr(version, name) for name in required):
        raise RuntimeError('unsupported original version-service exports')
    expected_result_fields = {
        'status', 'local', 'cloud', 'content', 'error', 'source', 'deadline',
        'remaining', 'terminate', 'reason', 'reminder', 'countdown',
        'check_count', 'state_path', 'log_path',
    }
    result_fields = {field.name for field in fields(version.CheckResult)}
    # 1.3.1 added two update-policy flags. Keep the exact known contracts;
    # an unrelated future shape still needs an explicit compatibility review.
    update_policy_flags = {'overdue', 'force'}
    if result_fields not in (expected_result_fields, expected_result_fields | update_policy_flags):
        raise RuntimeError('unsupported original CheckResult contract')
    if not {'version', 'content', 'describes', 'update_time', 'raw'}.issubset(
            {field.name for field in fields(version.CloudInfo)}):
        raise RuntimeError('unsupported original CloudInfo contract')
    checker_class = version.VersionChecker
    if any(not callable(getattr(checker_class, name, None))
           for name in ('__init__', 'check', 'snapshot')):
        raise RuntimeError('unsupported original VersionChecker contract')

    component_version = str(version.VERSION)

    def local_result(checker=None):
        local = str(getattr(checker, 'local_version', component_version))
        return version.CheckResult(
            status='ok', local=local, cloud='', content=DISABLED_MESSAGE,
            error='', source=LOCAL_SOURCE, deadline=0.0, remaining=0.0,
            terminate=False, reason='', reminder=False, countdown=False,
            check_count=0, state_path='', log_path='',
            **{name: False for name in update_policy_flags & result_fields},
        )

    def local_summary(self):
        return DISABLED_MESSAGE

    def local_checker_init(self, *, url=None, state_path=None, log_path=None,
                           local_version=None, clock=time.time, session=None,
                           timeout=15, logger=None, grace_seconds=86400.0,
                           countdown_seconds=7200.0):
        # Preserve the observed instance contract without reading an upstream
        # version cache or inheriting its delayed termination markers.
        self.url = ''
        self.state_path = Path(state_path) if state_path is not None else version.DEFAULT_STATE_PATH
        self.log_path = Path(log_path) if log_path is not None else version.DEFAULT_LOG_PATH
        self.local_version = str(local_version if local_version is not None else component_version)
        self._clock = clock
        self._session = session
        self.timeout = timeout
        self.log = logger if logger is not None else version.get_logger('version')
        self.grace_seconds = grace_seconds
        self.countdown_seconds = countdown_seconds
        self.state = version.VersionState(local_version=self.local_version,
                                           last_result=LOCAL_SOURCE)

    def local_check(self, *, source='hourly'):
        return local_result(self)

    def local_snapshot(self):
        return local_result(self)

    def local_cloud_info(*, url=None, session=None, timeout=15, logger=None):
        return version.CloudInfo(
            version=component_version, content=DISABLED_MESSAGE,
            describes=DISABLED_MESSAGE, update_time='',
            raw={'source': LOCAL_SOURCE, 'updates_disabled': True},
        )

    def blocked_read_source(url, *, session, timeout):
        raise version.VersionNetworkError('upstream version requests are disabled by fusion')

    def disabled_hourly_loop(checker, stop_event, on_result, *, interval=3600.0, logger=None):
        # Keep the original worker's cooperative shutdown contract. Publish
        # one local state and sleep on its stop event without periodic checks.
        if callable(on_result):
            on_result(local_result(checker))
        stop_event.wait()

    replacements = (
        (version.fetch_cloud_info, local_cloud_info),
        (version._read_source, blocked_read_source),
        (version.hourly_loop, disabled_hourly_loop),
        (checker_class.__init__, local_checker_init),
        (checker_class.check, local_check),
        (checker_class.snapshot, local_snapshot),
        (version.CheckResult.summary, local_summary),
    )
    version.fetch_cloud_info = local_cloud_info
    version._read_source = blocked_read_source
    version.hourly_loop = disabled_hourly_loop
    checker_class.__init__ = local_checker_init
    checker_class.check = local_check
    checker_class.snapshot = local_snapshot
    version.CheckResult.summary = local_summary

    patched_aliases = []
    for module_name, module in tuple(sys.modules.items()):
        if module is None or not (module_name.startswith('server.') or
                                  module_name.startswith('manager.')):
            continue
        for alias, value in tuple(vars(module).items()):
            for original, replacement in replacements:
                if value is original:
                    setattr(module, alias, replacement)
                    patched_aliases.append(module_name + '.' + alias)
                    break

    result = {
        'installed': True,
        'upstream_updates_enabled': False,
        'source': LOCAL_SOURCE,
        'component_version': component_version,
        'patched_aliases': sorted(patched_aliases),
    }
    version._fusion_disabled_updates = result
    return dict(result)
