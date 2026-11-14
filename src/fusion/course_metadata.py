"""Preserve date fields discarded by the original course-list serializer.

Reads responses of existing course-list requests; makes no additional requests.
Missing dates stay unknown, never inferred from course names or completion flags.
"""
from datetime import datetime, date, timezone, timedelta
from functools import wraps
from copy import copy


def course_date(value):
    if type(value) in (int, float):
        try:
            return datetime.fromtimestamp(value / (1000 if value > 100000000000 else 1), timezone(timedelta(hours=8))).date().isoformat() if value > 0 else ''
        except (ValueError, OverflowError, OSError):
            return ''
    if not isinstance(value, str):
        return ''
    value = value.strip().replace('/', '-').replace('年', '-').replace('月', '-').replace('日', '')
    if value.isdigit() and len(value) in (10, 13):
        return course_date(int(value))
    try:
        parts = value[:10].split('-')
        return date(*[int(p) for p in parts]).isoformat() if len(parts) == 3 else ''
    except ValueError:
        return ''


def dates(raw):
    if not isinstance(raw, dict):
        return {'start_date': '', 'end_date': ''}
    start = ('start_date', 'begindate', 'begintime', 'startDate', 'startTime', 'starttime', 'startdate', 'courseStartTime', 'coursestarttime', 'beginTime')
    end = ('end_date', 'endDate', 'endTime', 'endtime', 'enddate', 'courseEndTime', 'courseendtime', 'expireTime')
    return {name: next((value for key in keys if (value := course_date(raw.get(key)))), '') for name, keys in (('start_date', start), ('end_date', end))}


def install():
    import core.course as courses
    import engine.app as app
    if getattr(app.AppEngine.course_payload, '_fusion_dates', False):
        return
    original_fetch, original_payload = app.fetch_courses, app.AppEngine.course_payload
    original_probe, original_known = app.AppEngine.probe_course_face, app.AppEngine.course_face_known
    original_after = app.AppEngine._after_courses_loaded
    def storage_key(course):
        return 'integration.course_dates.' + str(course.course_id) + '.' + str(course.clazz_id)

    @wraps(original_known)
    def known(engine, course):
        # Reuse the original background probe once when upgrading from a cache
        # that contains only the face-check flag, without requesting on every load.
        return original_known(engine, course) and (engine.store.get(storage_key(course)) or {}).get('checked') is True

    @wraps(original_probe)
    def probe(engine, course):
        metadata = None
        class SessionView:
            def __getattr__(self, name):return getattr(engine.session, name)
            def get(self, url, *args, **kwargs):
                nonlocal metadata
                if '/gas/clazz' in url:
                    kwargs = dict(kwargs);params = dict(kwargs.get('params') or {})
                    if isinstance(params.get('fields'), str):
                        params['fields'] += ',enddate,endDate,endtime'
                    kwargs['params'] = params
                response = engine.session.get(url, *args, **kwargs)
                if '/gas/clazz' in url and response.status_code == 200:
                    try:
                        data = response.json()
                        if isinstance(data.get('data'), list) and data['data']:
                            from core.course_status import parse_course_status
                            status = parse_course_status(data)
                            metadata = {'start_date': course_date(status.start_date),
                                        'end_date': course_date(status.end_date), 'checked': True}
                    except (ValueError, TypeError, AttributeError):pass
                return response
        view = copy(engine);view.session = SessionView()
        result = original_probe(view, course)
        if metadata is not None:
            engine.store.set(storage_key(course), metadata)
            course.extra = {**(course.extra or {}), 'fusion_dates': metadata}
        return result

    @wraps(original_fetch)
    def fetch(session, **kwargs):
        metadata = {}
        class SessionView:
            def __getattr__(self, name):
                return getattr(session, name)
            def get(self, url, *args, **kw):
                response = session.get(url, *args, **kw)
                if '/mycourse/backclazzdata' in url:
                    try:
                        for item in response.json().get('channelList', []):
                            content = item.get('content') or {}
                            detail = ((content.get('course') or {}).get('data') or [{}])[0]
                            value = dates({**detail, **content, **item})
                            metadata[(str(detail.get('id', '')), str(item.get('key') or content.get('id') or ''))] = value
                    except (ValueError, TypeError, AttributeError, IndexError):
                        pass
                return response
        result = original_fetch(SessionView(), **kwargs)
        for course in result:
            value = metadata.get((str(course.course_id), str(course.clazz_id)), dates(course.extra))
            course.extra = {**(course.extra or {}), 'fusion_dates': value}
        return result

    @wraps(original_payload)
    def payload(engine, course):
        value = original_payload(engine, course)
        value.update({key: item for key, item in (engine.store.get(storage_key(course)) or (course.extra or {}).get('fusion_dates') or dates(course.extra)).items() if key in ('start_date', 'end_date')})
        value['finished'] = course.finished is True
        return value
    payload._fusion_dates = True
    @wraps(original_after)
    def after_loaded(engine):
        result = original_after(engine)
        # The initial course event precedes the background date probes. Publish
        # one completed snapshot so the first panel load needs no manual reload.
        engine.emit({'type': 'courses.changed', 'payload': {
            'courses': [engine.course_payload(course) for course in engine.courses]}})
        return result
    courses.fetch_courses = app.fetch_courses = fetch
    app.AppEngine.course_payload = payload
    app.AppEngine.probe_course_face = probe
    app.AppEngine.course_face_known = known
    app.AppEngine._after_courses_loaded = after_loaded
