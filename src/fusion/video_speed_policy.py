"""Observe public Chaoxing player permission metadata without additional I/O.

Contract: official modules/video/index.js 2026-1012-05 and
videojs-ext.min.js 2026-1012-06. Fast-forward is unrelated to playback speed.
"""
from functools import wraps
from html.parser import HTMLParser
import importlib
import json
from pathlib import Path
from urllib.parse import urlsplit

SOURCE = 'chaoxing-player-2026-1012'
POLICY_KEY = '_fusion_video_permission'
CARD_KEY = '_fusion_video_frames'
MAX_HTML = 2 * 1024 * 1024
MAX_PREFERENCES = 1024 * 1024


def _flag(value, allowed=(0, 1)):
    if type(value) in (bool, int, float) and value in allowed:
        return int(value)
    if isinstance(value, str) and value in tuple(str(v) for v in allowed):
        return int(value)
    return 'invalid'


def _identity(value):
    if type(value) is int:
        value = str(value)
    if not isinstance(value, str) or not value or len(value) > 256 or value != value.strip():
        return ''
    return value if not any(ord(c) < 32 for c in value) else ''


def _institution(value):
    value = _identity(value)
    if not value or not value.isascii() or not value.isdigit() or len(value) > 20:
        return None
    return str(int(value)) if int(value) > 0 else None


class _Frames(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []

    def handle_starttag(self, tag, pairs):
        if tag.lower() != 'iframe':
            return
        attrs = dict(pairs)
        path = urlsplit(attrs.get('src') or '').path
        if attrs.get('module') not in ('insertvideo', 'video') and not path.endswith('/ananas/modules/video/index.html'):
            return
        if len(self.rows) >= 500:
            raise ValueError('too_many_video_frames')
        data = None
        try:
            raw = attrs.get('data')
            data = json.loads(raw) if isinstance(raw, str) and len(raw) <= 65536 else None
        except (ValueError, TypeError):
            pass
        data = data if isinstance(data, dict) else None

        def identity(attribute, *keys):
            # Original course-card markup keeps identifiers in data JSON. The
            # hydrated player can also expose them as HTML attributes. Accept
            # either representation, but never guess across conflicting IDs.
            raw = [attrs.get(attribute), *((data or {}).get(key) for key in keys)]
            values = {_identity(value) for value in raw if value is not None and value != ''}
            if '' in values or len(values) > 1:
                raise ValueError('conflicting_video_frame_identity')
            return next(iter(values), '')

        object_id = identity('objectid', 'objectid')
        if not object_id:
            return
        row = {'objectid': object_id, 'jobid': identity('jobid', '_jobid', 'jobid'),
               'doublespeed': _flag(data['doublespeed']) if data is not None and 'doublespeed' in data
                              else 'missing' if data is not None else 'invalid'}
        self.rows.append(row)


def _frames(text):
    if not isinstance(text, str) or len(text) > MAX_HTML:
        return {'source': SOURCE, 'valid': False, 'rows': []}
    parser = _Frames()
    try:
        parser.feed(text)
        parser.close()
        return {'source': SOURCE, 'valid': True, 'rows': parser.rows}
    except Exception:
        return {'source': SOURCE, 'valid': False, 'rows': []}


def _metadata(data, point):
    extra = point.extra if isinstance(point.extra, dict) else {}
    prop = extra.get('property')
    defaults = data.get('defaults')
    default_known = isinstance(defaults, dict)
    defaults = defaults if default_known else {}
    prop_known = isinstance(prop, dict)
    prop = prop if prop_known else {}
    object_id = _identity(prop.get('objectid'))
    job_id = _identity(extra.get('job_id'))
    captured = data.get(CARD_KEY)
    frame_value, valid = 'missing', bool(prop_known and object_id)
    if captured is not None:
        if not isinstance(captured, dict) or captured.get('source') != SOURCE or captured.get('valid') is not True:
            valid = False
        else:
            rows = captured.get('rows')
            if not isinstance(rows, list):
                valid = False
            else:
                matches = [row for row in rows if isinstance(row, dict)
                           and row.get('objectid') == object_id and row.get('jobid') == job_id]
                if len(matches) > 1:
                    frame_value = 'conflict'
                elif matches:
                    frame_value = matches[0].get('doublespeed', 'invalid')
                    if frame_value not in (0, 1, 'missing', 'invalid'):
                        frame_value = 'invalid'
    return {'source': SOURCE, 'valid': valid, 'defaults_known': default_known,
            'cFid': _institution(defaults.get('cFid')),
            'schooldoublespeed': _flag(defaults['schooldoublespeed'], (0, 1, 2))
                                if 'schooldoublespeed' in defaults else 'missing',
            'property_doublespeed': _flag(prop['doublespeed']) if 'doublespeed' in prop else 'missing',
            'iframe_doublespeed': frame_value}


def install(taskpoint_module=None):
    """Install once before engine imports; preserve original objects/signatures."""
    module = taskpoint_module or importlib.import_module('core.taskpoint')
    existing = getattr(module, '_fusion_video_speed_policy', None)
    if existing is not None:
        return dict(existing)
    original_cards, original_points = module.parse_cards_js, module.parse_task_points

    @wraps(original_cards)
    def parse_cards_js(text):
        result = original_cards(text)
        if isinstance(result, dict):
            result[CARD_KEY] = _frames(text)
        return result

    @wraps(original_points)
    def parse_task_points(data, chapter_id=''):
        points = original_points(data, chapter_id)
        if not isinstance(data, dict):
            return points
        for point in points:
            if getattr(point, 'task_type', '') != 'video':
                continue
            try:
                metadata = _metadata(data, point)
            except Exception:
                metadata = {'source': SOURCE, 'valid': False}
            point.extra = {**(point.extra if isinstance(point.extra, dict) else {}), POLICY_KEY: metadata}
        return points

    module.parse_cards_js, module.parse_task_points = parse_cards_js, parse_task_points
    module._fusion_video_speed_policy = {'installed': True, 'source': SOURCE}
    return dict(module._fusion_video_speed_policy)


def permission(task):
    extra = getattr(task, 'extra', None)
    meta = extra.get(POLICY_KEY) if isinstance(extra, dict) else None
    if (not isinstance(meta, dict) or meta.get('source') != SOURCE or meta.get('valid') is not True
            or meta.get('defaults_known') is not True):
        return 'unknown', 'metadata_unavailable'
    institution = _institution(meta.get('cFid'))
    if institution is None:
        return 'unknown', 'institution_unknown'
    if institution == '259036':
        return 'disallowed', 'institution_below_2x'
    school, prop, frame = (meta.get('schooldoublespeed'), meta.get('property_doublespeed'),
                           meta.get('iframe_doublespeed'))
    if school not in (0, 1, 2, 'missing') or prop not in (0, 1, 'missing') or frame not in (0, 1, 'missing'):
        return 'unknown', 'metadata_ambiguous'
    if school == 0:
        return 'disallowed', 'school_disallowed'
    if school == 1:
        return 'allowed', 'school_allowed'
    if prop == 0 or frame == 0:
        return 'disallowed', 'video_disallowed'
    if frame == 1:
        return 'allowed', 'video_allowed'
    return 'unknown', 'video_permission_unknown'


def select_speed(task, manual_speed, preferences_path):
    """Read the shared preference once at video start; never overwrite manual speed."""
    if preferences_path is None:
        return {'beisu': manual_speed, 'auto_enabled': False, 'decision': 'manual',
                'decision_reason': 'legacy_manual', 'policy_source': None}
    try:
        try:
            with Path(preferences_path).open('rb') as stream:
                raw = stream.read(MAX_PREFERENCES + 1)
        except FileNotFoundError:
            raw = b'{}'
        if len(raw) > MAX_PREFERENCES:
            raise ValueError('preferences_too_large')
        preferences = json.loads(raw)
        if not isinstance(preferences, dict) or type(preferences.get('autoVideo2x', True)) is not bool:
            raise ValueError('preferences_invalid')
        enabled = preferences.get('autoVideo2x', True)
    except (OSError, ValueError, TypeError, UnicodeError):
        return {'beisu': 1, 'auto_enabled': True, 'decision': 'unknown',
                'decision_reason': 'preferences_unavailable', 'policy_source': SOURCE}
    if not enabled:
        return {'beisu': manual_speed, 'auto_enabled': False, 'decision': 'manual',
                'decision_reason': 'auto_disabled', 'policy_source': None}
    decision, reason = permission(task)
    return {'beisu': 2 if decision == 'allowed' else 1, 'auto_enabled': True,
            'decision': decision, 'decision_reason': reason, 'policy_source': SOURCE}


def log_message(selection):
    if not selection['auto_enabled']:
        return '自动倍速已关闭，本视频使用账号保存的手动倍速。'
    if selection['decision'] == 'allowed':
        return '自动倍速：平台许可允许二倍速，本视频使用 2x。'
    if selection['decision'] == 'disallowed':
        return '自动倍速：平台设置不允许二倍速，本视频使用 1x。'
    return '自动倍速：无法确认平台倍速许可，本视频保守使用 1x。'
