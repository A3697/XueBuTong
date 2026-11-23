"""Account-local opening monitor, using the original engine and one runner only."""
import copy
import hmac
import json
import re
import threading
import time
from contextlib import contextmanager
from functools import wraps

CONFIG = 'config.fusion_course_watch'
SEEN = 'integration.course_watch_seen'
SUSPENDED = 'integration.course_watch_suspended'


class MonitorBlocked(RuntimeError):
    pass


class ScanCancelled(RuntimeError):
    pass


def normalize(value):
    if not isinstance(value, dict):
        raise ValueError('监控配置无效')
    enabled, interval, courses = value.get('enabled', False), value.get('interval_seconds', 300), value.get('courses', [])
    if type(enabled) is not bool or type(interval) is not int or not 60 <= interval <= 86400:
        raise ValueError('扫描间隔必须为 60～86400 秒')
    if not isinstance(courses, list) or len(courses) > 200:
        raise ValueError('最多选择 200 门课程')
    rows = {}
    for course in courses:
        if not isinstance(course, dict) or any(not isinstance(course.get(k), str) or not re.fullmatch(r'[0-9]{1,32}', course[k]) for k in ('course_id', 'clazz_id')):
            raise ValueError('课程标识无效')
        rows[course['course_id'] + ':' + course['clazz_id']] = {k: course[k] for k in ('course_id', 'clazz_id')}
    if enabled and not rows:
        raise ValueError('请至少选择一门课程')
    return {'enabled': enabled, 'interval_seconds': interval, 'courses': list(rows.values())}


def course_key(course):
    return str(course.course_id) + ':' + str(course.clazz_id)


def task_pending(point, force_optional=False):
    extra = getattr(point, 'extra', {}) or {}
    if extra.get('isPassed') is True or extra.get('completion_verified') is True or getattr(point, 'server_done', False):
        return False
    # Optional quizzes are governed by the same managed force-answer setting;
    # parent completion alone must not manufacture a submitted quiz result.
    if force_optional and extra.get('is_job') is False and getattr(point, 'task_type', '') in ('work', 'workid', 'quiz'):
        return True
    return not bool(getattr(point, 'finished', False))


def read_course(engine, course, cancelled):
    """Read catalogue/cards only. Missing cards are unknown, never an opening."""
    from core.taskpoint import fetch_chapter_tree, fetch_task_points_ex
    class SessionView:
        def __getattr__(self, name):
            return getattr(engine.session, name)
        def get(self, *args, **kwargs):
            if cancelled():
                raise ScanCancelled()
            response = engine.session.get(*args, **kwargs)
            if cancelled():
                raise ScanCancelled()
            return response
    session = SessionView()
    tree = fetch_chapter_tree(session, clazz_id=course.clazz_id, cpi=course.cpi, timeout=20)
    if tree.face_check or getattr(tree.status, 'face_check', False):
        raise MonitorBlocked('课程要求本人验证，监控已暂停')
    if getattr(tree.status, 'filed', False):
        return []
    observations = []
    for chapter in tree.chapters:
        if cancelled():
            break
        cid = str(chapter.chapter_id)
        if not re.fullmatch(r'[0-9]{1,32}', cid):
            continue
        # Skip catalogue containers. Only leaf chapters have runnable cards.
        if any(str(getattr(child, 'parent_node_id', '')) == cid for child in tree.chapters):
            continue
        # Confirmed in the official Android Course2/ChapterDetailViewModel:
        # close = teacher-closed, time = outside the chapter's opening window.
        # task is rule-dependent, and numeric/absent states remain unknown.
        if str(chapter.status) in ('close', 'time'):
            observations.append({'chapter_id': cid, 'available': False})
            continue
        result = fetch_task_points_ex(session, course_id=course.course_id,
            clazz_id=course.clazz_id, chapter_id=cid, cpi=course.cpi, timeout=20, use_cache=False)
        if result.face_check:
            raise MonitorBlocked('章节要求本人验证，监控已暂停')
        if not result.points or result.diag.get('locked_hint'):
            # The original engine uses the same hint for genuinely empty,
            # sequentially locked and unpublished pages. Do not guess status.
            continue
        settings = (engine.store.get('config.fusion_answer_policy') or {}).get('settings', {})
        force_optional = settings.get('work-when-no-job') is True
        pending = any(task_pending(p, force_optional) and ((getattr(p, 'extra', {}) or {}).get('is_job') is not False
                      or force_optional) for p in result.points)
        observations.append({'chapter_id': cid, 'available': True, 'pending': pending})
    return observations


class CourseWatch:
    def __init__(self, engine, store, blacklist=lambda: (), reader=read_course, clock=time.time):
        self.engine, self.store, self.blacklist, self.reader, self.clock = engine, store, blacklist, reader, clock
        self.gate, self.local = threading.RLock(), threading.local()
        self.wake, self.closed = threading.Event(), threading.Event()
        self.thread = None
        self.generation, self.transition = 0, False
        self.next_scan, self.last_scan = 0, None
        self.message, self.status = '', 'disabled'
        self.suspended = bool(store.get(SUSPENDED))
        try:
            self.config = normalize(store.get(CONFIG) or {})
        except (ValueError, TypeError):
            self.config = normalize({})
        raw = store.get(SEEN) or {}
        self.seen = {k: v for k, v in raw.items() if isinstance(k, str) and type(v) is bool} if isinstance(raw, dict) else {}
        self._wrap_engine()

    def snapshot(self):
        with self.gate:
            status = 'disabled' if not self.config['enabled'] else 'suspended' if self.suspended else self.status
            return {'config': copy.deepcopy(self.config), 'state': {'status': status, 'suspended': self.suspended,
                'message': self.message, 'last_scan_at': self.last_scan, 'next_scan_at': self.next_scan or None}}

    def emit(self):
        self.engine.emit({'type': 'integration.course-watch', 'payload': self.snapshot()})

    def configure(self, value):
        config = normalize(value)
        with self.gate:
            self.store.set(CONFIG, config)
            self.config = config
            self.generation += 1
            self.next_scan = 0
            self.message = ''
            self.suspended = False
            self.store.set(SUSPENDED, False)
        self.wake.set()
        self.emit()
        return self.snapshot()

    def suspend(self, message='已手动暂停监控；恢复监控后继续检查'):
        with self.gate:
            self.suspended = True
            self.generation += 1
            self.message = message
            self.store.set(SUSPENDED, True)
        self.wake.set()
        self.emit()

    def resume(self):
        with self.gate:
            self.suspended = False
            self.generation += 1
            self.next_scan = 0
            self.message = ''
            self.store.set(SUSPENDED, False)
        self.wake.set()
        self.emit()
        return self.snapshot()

    @contextmanager
    def internal(self):
        old = getattr(self.local, 'internal', False)
        self.local.internal = True
        try:
            yield
        finally:
            self.local.internal = old

    def _wrap_engine(self):
        for name in ('queue_add', 'queue_remove', 'queue_move', 'start_run', 'resume', 'pause', 'stop'):
            original = getattr(self.engine, name)
            def wrap(method, operation):
                @wraps(method)
                def call(*args, **kwargs):
                    internal = getattr(self.local, 'internal', False)
                    with self.gate:
                        if operation in ('start_run', 'resume') and self.transition and not internal:
                            raise RuntimeError('正在优先切换新开放章节，请稍后操作')
                        if operation.startswith('queue_') and self.transition and not internal and threading.current_thread() is not getattr(self.engine, '_run_worker', None):
                            self.suspend('队列已手动更改，自动切换已取消；确认队列后可恢复监控')
                        if operation in ('pause', 'stop') and not internal and not self.closed.is_set():
                            self.suspend()
                        result = method(*args, **kwargs)
                        if operation in ('start_run', 'resume') and not internal:
                            self.resume()
                        return result
                return call
            setattr(self.engine, name, wrap(original, name))

    def valid(self, generation):
        return (not self.closed.is_set() and self.config['enabled'] and not self.suspended
                and self.generation == generation and bool(self.engine.logged_in))

    def selected(self, config):
        blocked = set(self.blacklist())
        return [c for c in config['courses'] if c['course_id'] + ':' + c['clazz_id'] not in blocked]

    def tick(self):
        with self.gate:
            if not self.config['enabled'] or self.suspended or self.closed.is_set():
                return
            if not self.engine.logged_in:
                self.status = 'waiting_login'
                return
            if self.clock() < self.next_scan:
                return
            generation, config = self.generation, copy.deepcopy(self.config)
            self.status, self.message = 'scanning', ''
        self.emit()
        try:
            for selected in self.selected(config):
                if not self.valid(generation):
                    return
                course = self.engine.find_course(selected['course_id'], selected['clazz_id'])
                if course is None:
                    self.message = '部分所选课程暂不可用，保留选择并在下次检查'
                    continue
                observations = self.reader(self.engine, course, lambda: not self.valid(generation))
                new_chapters = []
                for row in observations:
                    if not self.valid(generation):
                        return
                    cid = str(row.get('chapter_id', ''))
                    if not re.fullmatch(r'[0-9]{1,32}', cid) or type(row.get('available')) is not bool:
                        continue
                    key = course_key(course) + ':' + cid
                    if row['available'] and row.get('pending') is True and self.seen.get(key) is not True:
                        if course_key(course) in set(self.blacklist()):
                            continue
                        active_index = getattr(self.engine, '_active_index', -1)
                        active = self.engine.queue[active_index] if 0 <= active_index < len(self.engine.queue) else None
                        already_active = (self.engine.is_running and active is not None
                            and course_key(active.course) == course_key(course)
                            and str(getattr(active, 'current_chapter_id', '') or active.chapter_id) == cid)
                        if not already_active:
                            new_chapters.append(cid)
                            continue
                    # Unknown observations do not reset prior successful work.
                    self.seen[key] = row['available']
                    self.store.set(SEEN, self.seen)
                if new_chapters:
                    if self.dispatch(course, new_chapters, generation):
                        for cid in new_chapters:
                            self.seen[course_key(course) + ':' + cid] = True
                        self.store.set(SEEN, self.seen)
                        self.status = 'waiting'
                    # A course's newly opened chapters enter one batch; do not
                    # immediately interrupt that batch for the next course.
                    return
            self.status = 'waiting'
        except ScanCancelled:
            pass
        except MonitorBlocked as error:
            self.suspend(str(error))
        except Exception:
            if self.valid(generation):
                self.status = 'error'
                self.message = '本轮检查未完成；不会把读取异常当作章节开放，将按间隔重试'
        finally:
            with self.gate:
                self.last_scan = self.clock()
                if generation == self.generation:
                    self.next_scan = self.last_scan + config['interval_seconds']
            self.emit()

    def dispatch(self, course, chapter_ids, generation):
        with self.gate:
            if not self.valid(generation):
                return False
            self.transition, self.status = True, 'switching'
        self.emit()
        try:
            # Never hold the gate while joining: the exiting worker emits queue
            # changes and blacklist cleanup can need the same short-lived gate.
            with self.internal():
                stopped = self.engine.stop_and_wait(timeout=10.0)
            if not stopped:
                self.suspend('当前任务尚未安全停止，未启动第二个任务；请确认状态后恢复监控')
                return False
            with self.gate, self.internal():
                if not self.valid(generation) or course_key(course) in set(self.blacklist()):
                    return False
                items = []
                for cid in chapter_ids:
                    item = next((q for q in self.engine.queue if course_key(q.course) == course_key(course) and str(q.chapter_id) == cid), None)
                    if item is None:
                        item = self.engine.queue_add(course, chapter_id=cid, mode='task')
                    else:
                        # A previously completed chapter can acquire new tasks.
                        # Reload the targeted item before trusting its old rows.
                        previous_status = item.status
                        item.status = 'loading'
                        try:
                            self.engine.request_load(item, force=True)
                        except Exception:
                            item.status = previous_status
                            raise
                    items.append(item)
                # Exact-chapter items are deliberately separate from the saved
                # whole-course item; original runner resumes its saved progress.
                for item in reversed(items):
                    index = self.engine.queue.index(item)
                    if index:
                        self.engine.queue_move(index, -index)
                self.status = 'loading'
            self.emit()
            deadline = time.monotonic() + 90
            while any(q.status == 'loading' for q in self.engine.queue):
                if not self.valid(generation):
                    return False
                if time.monotonic() >= deadline:
                    self.suspend('章节加载尚未完成，队列和原进度已保留；请确认后恢复监控')
                    return False
                self.closed.wait(0.2)
            with self.gate, self.internal():
                if not self.valid(generation) or course_key(course) in set(self.blacklist()):
                    return False
                if any(item not in self.engine.queue for item in items):
                    self.suspend('优先章节已移出队列，自动启动已取消')
                    return False
                from integration_controls import run_options
                options = run_options(self.store)
                # Resuming interrupted work must never clear saved progress.
                options['ignore_progress'] = False
                self.engine.start_run(options)
                self.message = '已优先执行开放章节，结束后继续原队列'
            return True
        finally:
            with self.gate:
                self.transition = False

    def start(self):
        if self.thread is not None:
            return
        def loop():
            while not self.closed.is_set():
                self.wake.clear()
                self.tick()
                self.wake.wait(1)
        self.thread = threading.Thread(target=loop, name='course-opening-watch', daemon=True)
        self.thread.start()

    def close(self):
        self.closed.set()
        self.wake.set()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=25)
        return not self.thread or not self.thread.is_alive()

    def install_routes(self, application, *, token, host, port):
        from starlette.requests import Request
        from starlette.responses import JSONResponse
        canonical = f'http://{host}:{port}'
        async def handle(request: Request):
            headers = request.headers
            tokens = headers.getlist('x-token')
            if not (len(tokens) == 1 and hmac.compare_digest(tokens[0].encode(), token.encode())
                    and headers.getlist('host') == [f'{host}:{port}']
                    and headers.getlist('origin') in ([], [canonical])):
                return JSONResponse({'error': 'local_auth_failed'}, status_code=403)
            try:
                if request.method == 'PUT':
                    body = await request.body()
                    if len(body) > 32768:
                        raise ValueError('监控配置过大')
                    result = self.configure(json.loads(body))
                elif request.method == 'POST':
                    result = self.resume()
                else:
                    result = self.snapshot()
                return JSONResponse(result, headers={'Cache-Control': 'no-store'})
            except (ValueError, TypeError, UnicodeError):
                return JSONResponse({'error': 'course_watch_config_invalid'}, status_code=400)
        for path, methods in (('/api/integration/course-watch', ['GET', 'PUT']), ('/api/integration/course-watch/resume', ['POST'])):
            application.add_api_route(path, handle, methods=methods, include_in_schema=False)
            application.router.routes.insert(0, application.router.routes.pop())


def install(engine, store, *, blacklist=lambda: ()):
    watcher = CourseWatch(engine, store, blacklist=blacklist)
    engine._fusion_course_watch = watcher
    return watcher
