"""Read-only completion summaries; never enqueue or run coursework."""
import math
import re
from html.parser import HTMLParser


def explicit_remaining(html):
    class StateInput(HTMLParser):
        value = None
        def handle_starttag(self, tag, attrs):
            attrs = dict(attrs)
            if tag == 'input' and attrs.get('id') == '_studystate':
                # The live platform wraps this field in {nextChapterId:...,unfinishCount:...}.
                # Missing/malformed fields must remain unknown, never become an implicit zero.
                match = re.search(r'''(?:^|[{,;\s])["']?unfinishCount["']?\s*:\s*(\d+)\s*(?=$|[},;\s])''', attrs.get('value', ''))
                if match:self.value = int(match.group(1))
    parser = StateInput();parser.feed(html)
    return parser.value


def task_summary(course, progress):
    total, done = progress.get('job_count'), progress.get('job_finish_count')
    if (type(total) in (int, float) and type(done) in (int, float)
            and math.isfinite(total) and math.isfinite(done) and total >= 0 and done >= 0):
        return {'known': True, 'total': int(total), 'done': min(int(done), int(total)),
                'complete': done >= total}
    if getattr(course, 'finished', False) is True:
        return {'known': True, 'total': None, 'done': None, 'complete': True}
    return {'known': False, 'complete': None}


def homework_summary(rows):
    if not isinstance(rows, list) or any(not isinstance(row, dict) or 'done' not in row for row in rows):
        return {'known': False, 'complete': None}
    # The original engine filters homework using the public list's `done` flag.
    # Accept its boolean/int representation, never infer completion from a title.
    if any(type(row['done']) not in (bool, int) or row['done'] not in (True, False, 0, 1) for row in rows):
        return {'known': False, 'complete': None}
    done = sum(bool(row['done']) for row in rows)
    return {'known': True, 'total': len(rows), 'done': done, 'complete': done == len(rows)}


def read_completion(engine, course_id, clazz_id, include_homework):
    course = engine.find_course(course_id, clazz_id)
    if course is None:
        raise KeyError('course_unavailable')
    progress = engine.course_progress(refresh=False) or {}
    result = {'task': task_summary(course, progress.get(str(clazz_id), {}))}
    # The list totals can lag behind the actual chapter catalogue. Use the same
    # catalogue as the task queue, without adding a queue item or fetching videos.
    try:
        from core.taskpoint import fetch_catalog_progress
        remaining = None
        class SessionView:
            def __getattr__(self, name):return getattr(engine.session, name)
            def get(self, *args, **kwargs):
                nonlocal remaining
                response = engine.session.get(*args, **kwargs)
                if response.status_code == 200:remaining = explicit_remaining(response.text)
                return response
        rows, _ = fetch_catalog_progress(SessionView(), course_id=course.course_id,
                                         clazz_id=course.clazz_id, cpi=course.cpi, timeout=20)
        if isinstance(rows, dict) and remaining is not None:
            counts = result['task']
            result['task'] = {'known': True, 'complete': remaining == 0,
                              'remaining': remaining, 'source': 'chapter_catalog'}
            if counts.get('total') is not None and counts.get('done') is not None and counts['total'] - counts['done'] == remaining:
                result['task'].update(total=counts['total'], done=counts['done'])
        elif not result['task'].get('complete'):
            result['task'] = {'known': False, 'complete': None}
    except Exception:
        if not result['task'].get('complete'):
            result['task'] = {'known': False, 'complete': None}
    if include_homework:
        try:
            from core.homework import fetch_homework_list
            if engine.session is None:
                raise ValueError('not_logged_in')
            rows = fetch_homework_list(engine.session, course.course_id, course.clazz_id,
                                       course.cpi, timeout=20)
            result['homework'] = homework_summary(rows)
        except Exception as error:
            result['homework'] = {'known': False, 'complete': None}
            from homework_catalog import HomeworkListError
            if isinstance(error, HomeworkListError):
                result['homework'].update(error=error.code, message=str(error))
    return result
