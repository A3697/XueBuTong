"""Read the official homework catalogue completely, without submitting work.

The protected engine's single-page parser remains in use. Course summaries and
queue loading share this adapter, including response validation and pagination.
"""
import hashlib
import re
import sys
import threading
import time
from html.parser import HTMLParser
from functools import wraps
from urllib.parse import urlencode, urlsplit

_STATE_LOCK = threading.Lock()
_INTERVAL = 0.35
_COOLDOWN = 120
_MAX_PAGES = 1000
_DONE = ('已完成', '已交', '已提交', '已批阅', '已作答', '待批阅', '待批改')


class HomeworkListError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


class _Inputs(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.values = {}
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'input':
            for key in ('id', 'name'):
                if attrs.get(key):
                    self.values[attrs[key]] = attrs.get('value', '')


def _state(session):
    with _STATE_LOCK:
        if not hasattr(session, '_fusion_homework_catalog'):
            session._fusion_homework_catalog = {'lock': threading.RLock(), 'last': 0,
                                               'blocked': 0, 'cookies': ''}
        return session._fusion_homework_catalog


def _cookie_identity(session):
    rows = sorted((c.domain, c.path, c.name, c.value) for c in session.cookies)
    return hashlib.sha256(repr(rows).encode('utf-8')).hexdigest()


def _checked(response):
    parts = urlsplit(response.url)
    text = response.text
    if response.status_code == 202 or 'antispider' in parts.path.lower() or 'antispiderShowVerify.ac' in text:
        raise HomeworkListError('verification_required', '平台要求安全验证，作业列表尚未读取；请在浏览器完成验证或重新登录，再刷新。')
    if parts.hostname in ('passport2.chaoxing.com', 'passport2-api.chaoxing.com') or re.search(r'/(?:login|loginpage)(?:[./]|$)', parts.path, re.I):
        raise HomeworkListError('login_required', '登录状态已失效，作业列表尚未读取；请重新登录后刷新。')
    if response.status_code != 200:
        raise HomeworkListError('http_error', '作业列表请求失败（HTTP %s），请稍后刷新。' % response.status_code)
    return text


def _get(session, state, url, timeout, headers):
    delay = _INTERVAL - (time.monotonic() - state['last'])
    if delay > 0:
        time.sleep(delay)
    try:
        return session.get(url, timeout=timeout, headers=headers)
    finally:
        state['last'] = time.monotonic()


def _page(text, course_id, clazz_id, expected_page):
    values = _Inputs(text).values
    if values.get('courseId') != str(course_id) or values.get('classId') != str(clazz_id) or values.get('status') != '0':
        raise HomeworkListError('unexpected_page', '平台未返回当前课程的完整作业列表，请刷新重试。')
    counts = re.search(r'<span\b[^>]*>\s*(\d+)\s*/\s*(\d+)\s*</span>', text, re.I)
    if not counts:
        raise HomeworkListError('missing_total', '平台未返回作业总数，暂不能确认完整列表，请刷新重试。')
    done, total = map(int, counts.groups())
    paging = re.search(r'\$\(["\x27]#page["\x27]\)\.paging\(\s*\{\s*nowPage\s*:\s*(\d+)\s*,\s*pageNum\s*:\s*(\d+)', text)
    current, pages = map(int, paging.groups()) if paging else (1, 1)
    if done > total or current != expected_page or not 1 <= pages <= _MAX_PAGES or current > pages:
        raise HomeworkListError('invalid_pagination', '作业分页信息不一致，请刷新重试。')
    return values, (done, total), pages


def fetch_homework_list(session, course_id, clazz_id, cpi, *, timeout=30):
    from core import homework
    state = _state(session)
    with state['lock']:
        identity = _cookie_identity(session)
        if state['blocked'] > time.monotonic() and identity == state['cookies']:
            raise HomeworkListError('verification_required', '作业读取仍在等待安全验证；两分钟内暂停重复请求，完成验证或重新登录后可刷新。')
        try:
            headers = {'User-Agent': homework.PC_UA}
            query = urlencode({'courseid': course_id, 'clazzid': clazz_id, 'cpi': cpi, 'ismooc2': 1, 'v': 2})
            response = _get(session, state, homework.MOOC1_HOST + homework.STU_MIDDLE_PATH + '?' + query, timeout, headers)
            text = _checked(response)
            enc = _Inputs(text).values.get('workEnc')
            if not enc:
                raise HomeworkListError('missing_entry', '当前课程页未提供作业入口（workEnc），请重新登录后刷新；未将其视为无作业。')
            query = {'courseId': course_id, 'classId': clazz_id, 'cpi': cpi, 'enc': enc, 'status': 0}
            found, expected, pages, number = {}, None, 1, 1
            while number <= pages:
                query['pageNum'] = number
                url = homework.MOOC1_HOST + '/mooc-ans/mooc2/work/list?' + urlencode(query)
                text = _checked(_get(session, state, url, timeout, headers))
                values, counts, page_count = _page(text, course_id, clazz_id, number)
                if expected is None:
                    expected, pages = counts, page_count
                elif counts != expected or page_count != pages:
                    raise HomeworkListError('catalogue_changed', '作业列表在读取期间发生变化，请刷新重试。')
                rows = homework.parse_homework_list(text)
                if not rows and (expected[1] != 0 or '暂无作业' not in text):
                    raise HomeworkListError('incomplete_page', '作业分页内容不完整，请刷新重试。')
                for source in rows:
                    row = dict(source)
                    key = str(row.get('work_id') or '')
                    if not key or key in found:
                        raise HomeworkListError('duplicate_page', '作业分页重复或缺少标识，未使用不完整列表，请刷新重试。')
                    # Pending grading is submitted work. A closed deadline alone
                    # does not mean the student has completed the assignment.
                    row['done'] = any(word in str(row.get('status', '')) for word in _DONE)
                    found[key] = row
                number += 1
            result = list(found.values())
            if len(result) != expected[1] or sum(row['done'] for row in result) != expected[0]:
                raise HomeworkListError('count_mismatch', '作业条目与平台总数或完成数不一致，请刷新重试。')
            state['blocked'] = 0
            return result
        except HomeworkListError as error:
            if error.code == 'verification_required':
                state['cookies'] = _cookie_identity(session)
                state['blocked'] = time.monotonic() + _COOLDOWN
            raise


def install():
    from core import homework
    original = homework.fetch_homework_list
    if original is fetch_homework_list:
        return
    # Some engine modules import the function before the host installs adapters.
    # Replace only bindings to this exact function, retaining the original parser
    # and homework executor, question answering, save and submit behavior.
    for name, module in tuple(sys.modules.items()):
        if name.startswith(('core.', 'engine.', 'server.')) and module is not None:
            for key, value in tuple(vars(module).items()):
                if value is original:
                    setattr(module, key, fetch_homework_list)
    homework.fetch_homework_list = fetch_homework_list
    from engine.app import AppEngine
    original_load = AppEngine._load_item

    @wraps(original_load)
    def load_item(engine, item, *, force=False):
        if getattr(item, 'mode', 'task') != 'homework':
            return original_load(engine, item, force=force)
        # The upstream route first loads chapter attachments even in homework
        # mode. A course with no chapters then carries a failed status into an
        # otherwise successful homework load. Use its existing homework loader
        # directly; retain its task conversion, completed-work filter and runner.
        item.status, item.error, item.empty_reason = 'loading', '', ''
        item._fusion_homework_loaded = False
        item.tasks = []
        def publish():
            if item in engine.queue:
                engine._emit_fn({'type': 'queue.item', 'payload': {
                    'index': engine.queue.index(item), 'item': engine.item_payload(item)}})
        publish()
        try:
            result = engine._load_homework_into(item)
            item._fusion_homework_loaded = item.status in ('ready', 'done') and not item.error
            return result
        except Exception as error:
            item.status, item.error = 'failed', str(error)
            raise
        finally:
            publish()

    AppEngine._load_item = load_item
