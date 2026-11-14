"""Remove unstarted blacklisted items without shifting the live runner's indices."""
from functools import wraps
import threading

KEY = 'integration.pending_queue_removals'


def identity(item):
    return [str(item.course.course_id), str(item.course.clazz_id), str(item.chapter_id), str(item.mode)]


def install(engine, store, state, blacklist=()):
    lock = threading.RLock()
    saved = store.get(KEY) or []
    pending = {tuple(value) for value in saved if isinstance(value, list) and len(value) == 4 and all(isinstance(v, str) for v in value)}
    active = None
    in_loop = False
    original_one, original_loop, original_payload = engine._run_one, engine._run_loop, engine.item_payload

    def persist():store.set(KEY, [list(value) for value in sorted(pending)])
    def marked(item):return tuple(identity(item)) in pending
    def cleanup():
        with lock:
            for index in range(len(engine.queue)-1, -1, -1):
                if marked(engine.queue[index]):engine.queue_remove(index)
            pending.clear();persist()

    @wraps(original_one)
    def run_one(item, index, args):
        nonlocal active
        with lock:
            if marked(item):return
            active = item
        try:return original_one(item, index, args)
        finally:
            with lock:active = None

    @wraps(original_loop)
    def run_loop(*args, **kwargs):
        nonlocal in_loop
        with lock:in_loop = True
        try:return original_loop(*args, **kwargs)
        finally:
            with lock:in_loop = False;cleanup()

    @wraps(original_payload)
    def payload(item):
        value = original_payload(item)
        value['pending_removal'] = marked(item)
        return value

    def prune(course_id, clazz_id):
        with lock:
            removed = 0
            for index, item in enumerate(engine.queue):
                if str(item.course.course_id) != course_id or str(item.course.clazz_id) != clazz_id:continue
                if item is active or index == getattr(engine, '_active_index', -1):continue
                if item.status not in ('pending', 'ready', 'loading') or item.current_chapter_id or item.report is not None or item.lazy_report is not None:continue
                if any(v not in ('pending', 'ready', 'loading', 'empty') for v in item.chapter_state.values()):continue
                key = tuple(identity(item))
                if key not in pending:pending.add(key);removed += 1
                item._fusion_pending_removal = True
            persist()
            running = in_loop or bool(engine._run_worker and engine._run_worker.is_alive())
            if not running:cleanup()
            # API arrays keep indices unchanged until the current loop exits.
            # UI hides pending-removal rows and the runner skips those objects.
            engine._emit_queue()
            return {'removed': removed, 'deferred': running and removed > 0}

    engine._run_one, engine._run_loop, engine.item_payload = run_one, run_loop, payload
    engine.prune_unstarted = prune
    # IntegrationState.restore_queue has already finished at this point.
    # Restored removals are applied before login or automatic run plans.
    with state.lock:
        cleanup()
        # A saved blacklist is authoritative even if the previous panel closed
        # between saving preferences and completing its HTTP prune request.
        for value in blacklist:
            if isinstance(value, str) and value.count(':') == 1:
                course_id, clazz_id = value.split(':')
                prune(course_id, clazz_id)
    return prune
