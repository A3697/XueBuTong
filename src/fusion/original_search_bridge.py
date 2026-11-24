"""Authenticated adapters around the shipped banks, with no account/config store.

POST /api/integration/original-bank or /api/integration/ai, X-Token required.
Body: {title,type,options:[{label,text}],blankCount,key,ai:{baseUrl,model,type}}.
Types: single/multiple/judgement/completion/short. AI types use original style names.
Hit: {kind:"hit",answer:"B"|"AC"|"对"|["blank one","blank two"]}.
Only verified explicit no-answer: {kind:"miss",explicitMiss:true}.
Errors have a non-2xx status and {error:{code:<fixed non-secret code>}}.

Importing this module has no target imports or network activity. Every query
gets a new bank and session; empty keys never reach original default settings.
"""
import asyncio
import hmac
import json
import re
import threading
from datetime import date
from urllib.parse import urlsplit

MAX_BODY = 65536
UPSTREAM_TIMEOUT = 25
_UNSET = object()


class BridgeError(Exception):
    def __init__(self, code, status=502):
        self.code, self.status = code, status
        super().__init__(code)  # No upstream text, URL, question, key, or exception repr.


def _text(value, maximum, code='request_invalid', *, empty=False):
    if (not isinstance(value, str) or len(value) > maximum
            or (not empty and not value.strip()) or any(ord(c) < 32 and c not in '\n\r\t' for c in value)):
        raise BridgeError(code, 400)
    return value


def _enrollment_year(value, today=None):
    if value is None:
        return None
    if type(value) is not int or not 1950 <= value <= (today or date.today()).year:
        raise BridgeError('enrollment_year_invalid', 400)
    return value


def student_description(enrollment_year, today=None):
    today = today or date.today()
    year = _enrollment_year(enrollment_year, today)
    if year is None:
        return '大学生'
    grade = max(1, today.year - (today.month < 9) - year + 1)
    return ('大' + '一二三四五'[grade - 1] + '学生') if grade <= 5 else f'入学第{grade}年的大学生'


def _configuration(payload, source):
    if not isinstance(payload, dict):
        raise BridgeError('request_invalid', 400)
    title = _text(payload.get('title'), 24000)
    kind = payload.get('type')
    if kind not in ('single', 'multiple', 'judgement', 'completion', 'short'):
        raise BridgeError('question_type_invalid', 400)
    local_ollama = source == 'ai' and isinstance(payload.get('ai'), dict) and payload['ai'].get('type') == 'ollama'
    key = _text(payload.get('key'), 4096, 'upstream_key_required', empty=local_ollama)
    if key != key.strip() or '\n' in key or '\r' in key or '\t' in key:
        raise BridgeError('upstream_key_invalid', 400)
    options = payload.get('options', [])
    if not isinstance(options, list) or len(options) > 26:
        raise BridgeError('options_invalid', 400)
    mapped, labels = [], set()
    for option in options:
        if not isinstance(option, dict):
            raise BridgeError('options_invalid', 400)
        label, text = option.get('label'), _text(option.get('text'), 12000)
        if not isinstance(label, str) or not re.fullmatch('[A-Z]', label) or label in labels:
            raise BridgeError('options_invalid', 400)
        labels.add(label)
        mapped.append({'label': label, 'text': text})
    if kind in ('single', 'multiple') and len(mapped) < 2:
        raise BridgeError('options_invalid', 400)
    if kind == 'judgement' and len(mapped) not in (0, 2):
        raise BridgeError('options_invalid', 400)
    blanks = payload.get('blankCount', 1 if kind == 'completion' else 0)
    if type(blanks) is not int or not 0 <= blanks <= 64 or (kind == 'completion' and blanks == 0):
        raise BridgeError('blank_count_invalid', 400)
    result = {'title': title, 'type': kind, 'options': mapped, 'blankCount': blanks, 'key': key,
              'courseName': _text(payload.get('courseName', ''), 500, empty=True),
              'enrollmentYear': _enrollment_year(payload.get('enrollmentYear'))}
    if source == 'ai':
        ai = payload.get('ai')
        if not isinstance(ai, dict):
            raise BridgeError('ai_configuration_required', 400)
        url = _text(ai.get('baseUrl'), 4096, 'ai_url_required')
        try:
            parsed = urlsplit(url)
            invalid = (not parsed.hostname or parsed.username is not None or parsed.password is not None
                       or bool(parsed.fragment) or bool(parsed.query) or parsed.port == 0)
        except ValueError:
            raise BridgeError('ai_url_invalid', 400) from None
        local_http = parsed.scheme == 'http' and parsed.hostname in ('127.0.0.1', 'localhost', '::1')
        if invalid or not (parsed.scheme == 'https' or local_http) or any(c.isspace() for c in url):
            raise BridgeError('ai_url_invalid', 400)
        style = ai.get('type', 'auto')
        if style not in ('auto', 'openai', 'anthropic', 'gemini', 'ollama'):
            raise BridgeError('ai_type_invalid', 400)
        result['ai'] = {'baseUrl': url, 'model': _text(ai.get('model'), 256, 'ai_model_required'), 'type': style}
    return result


class _ObservedSession:
    """Pass original requests through unchanged; retain status/JSON to disambiguate failures.

    Tests inject a fake Session via OriginalSearchService(session_factory=...).
    Production uses requests.Session and the original banks' endpoints/payloads.
    """
    def __init__(self, underlying, *, judgement=False):
        self.underlying = underlying
        self.judgement = judgement
        self.judgement_response = None
        self.responses = []
        self.failure = None

    def __getattr__(self, name):
        return getattr(self.underlying, name)

    def request(self, method, url, **kwargs):
        if self.judgement_response is not None:
            return self.judgement_response
        try:
            response = self.underlying.request(method, url, **kwargs)
        except Exception as exc:
            from requests.exceptions import Timeout, ConnectionError
            code = 'upstream_timeout' if isinstance(exc, Timeout) else 'upstream_network_error' if isinstance(exc, ConnectionError) else 'upstream_request_failed'
            self.failure = BridgeError(code, 504 if code == 'upstream_timeout' else 502)
            raise self.failure from None
        status = getattr(response, 'status_code', None)
        if type(status) is not int:
            self.failure = BridgeError('upstream_response_invalid')
            raise self.failure
        if not 200 <= status <= 299:
            code = {401: 'upstream_auth_failed', 403: 'upstream_auth_failed', 402: 'upstream_quota_failed',
                    429: 'upstream_rate_limited'}.get(status, 'upstream_http_failed')
            self.failure = BridgeError(code, 429 if status == 429 else 502)
            raise self.failure
        try:
            body = response.json()
        except Exception:
            self.failure = BridgeError('upstream_json_invalid')
            raise self.failure from None
        if not isinstance(body, dict):
            self.failure = BridgeError('upstream_response_invalid')
            raise self.failure
        self.responses.append(body)
        if body.get('error') not in (None, '', False, {}, []):
            self.failure = BridgeError('upstream_reported_error')
            raise self.failure
        if self.judgement and _ai_judgement_value(body) is not _UNSET:
            # The original judgment normalizer can reject even "对" with reversed
            # displayed options. Its retry must not charge for the same valid
            # answer again. This cache lives only for this single question.
            self.judgement_response = response
        return response

    def post(self, url, **kwargs):
        return self.request('POST', url, **kwargs)

    def get(self, url, **kwargs):
        return self.request('GET', url, **kwargs)

    def close(self):
        close = getattr(self.underlying, 'close', None)
        if callable(close):
            close()


def _ai_answer_value(body):
    """Read the original response's one answer field before provider normalization."""
    texts = []
    choices = body.get('choices')
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        message = choices[0].get('message')
        if isinstance(message, dict) and isinstance(message.get('content'), str):
            texts.append(message['content'])
    candidates = body.get('candidates')
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        content = candidates[0].get('content')
        if isinstance(content, dict) and isinstance(content.get('parts'), list):
            texts.append(''.join(p['text'] for p in content['parts'] if isinstance(p, dict) and isinstance(p.get('text'), str)))
    content = body.get('content')
    if isinstance(content, list):
        texts.append(''.join(p['text'] for p in content if isinstance(p, dict) and p.get('type') == 'text' and isinstance(p.get('text'), str)))
    message = body.get('message')
    if isinstance(message, dict) and isinstance(message.get('content'), str):
        texts.append(message['content'])
    if len(texts) != 1:
        return _UNSET
    try:
        value = json.loads(texts[0])
    except (ValueError, TypeError):
        return _UNSET
    return value.get('answer', _UNSET) if isinstance(value, dict) else _UNSET


def _strict_ai_null(body):
    return _ai_answer_value(body) is None


def _ai_judgement_value(body):
    value = _ai_answer_value(body)
    if type(value) is bool:
        return '对' if value else '错'
    if isinstance(value, str):
        value = value.strip().lower()
        if value in ('对', '正确', 'true', 't', '√', '是'):
            return '对'
        if value in ('错', '错误', 'false', 'f', '×', '否'):
            return '错'
    return _UNSET


def _explicit_bank_miss(body):
    # Observed original query gate: code == 0, result.success is false.
    # Missing/malformed result also becomes "未收录" in the original; reject it here.
    result = body.get('result')
    if type(body.get('code')) is not int or body['code'] != 0 or not isinstance(result, dict) or result.get('success') is not False:
        return False
    for document in (body, result):
        if document.get('error') not in (None, '', False, {}, []):
            return False
        for key in ('message', 'msg'):
            # Unknown messages can describe quota/auth/backend faults even with a bad success code.
            if document.get(key) not in (None, '', '题库未收录该题', '未收录该题', '未收录'):
                return False
    return not result.get('answers')


def _answer_for_gateway(answer, config):
    normalized = getattr(answer, 'normalized', '')
    extra = getattr(answer, 'extra', {})
    if not isinstance(extra, dict):
        raise BridgeError('upstream_answer_invalid')
    kind = config['type']
    if kind in ('single', 'multiple'):
        indexes = extra.get('matched_indices')
        if not isinstance(indexes, list) or not indexes or any(type(i) is not int or not 0 <= i < len(config['options']) for i in indexes):
            raise BridgeError('upstream_answer_invalid')
        indexes = sorted(set(indexes))
        if kind == 'single' and len(indexes) != 1:
            raise BridgeError('upstream_answer_invalid')
        return ''.join(config['options'][i]['label'] for i in indexes)
    if kind == 'completion':
        parts = getattr(answer, 'parts', None)
        if not isinstance(parts, list) or len(parts) != config['blankCount'] or any(not isinstance(p, str) or not p.strip() for p in parts):
            raise BridgeError('upstream_answer_invalid')
        return parts
    if kind == 'short':
        if not isinstance(normalized, str) or not normalized.strip() or len(normalized) > 24000:
            raise BridgeError('upstream_answer_invalid')
        return normalized.strip()
    value = normalized.strip().lower() if isinstance(normalized, str) else ''
    if value in ('正确', '对', 'true', '√', '是', '1'):
        return '对'
    if value in ('错误', '错', 'false', '×', '否', '0'):
        return '错'
    raise BridgeError('upstream_answer_invalid')


class OriginalSearchService:
    def __init__(self, *, session_factory=None):
        self.session_factory = session_factory

    def query(self, source, payload):
        if source not in ('ai', 'original-bank'):
            raise BridgeError('search_method_invalid', 400)
        config = _configuration(payload, source)
        from core.question_bank.models import Question, QuestionType, QueryContext
        from core.question_bank import exceptions
        from core.question_bank.ai import AIBank
        from core.question_bank.tiku168 import Tiku168Bank
        from requests import Session
        qtype = {'single': QuestionType.SINGLE_CHOICE, 'multiple': QuestionType.MULTIPLE_CHOICE,
                 'judgement': QuestionType.JUDGE, 'completion': QuestionType.FILL_BLANK,
                 'short': QuestionType.SHORT_ANSWER}[config['type']]
        question = Question(stem=config['title'], qtype=qtype, options=[o['text'] for o in config['options']],
                            answer_num=config['blankCount'], course_name=config['courseName'],
                            extra={'fusion_study_prompt': source == 'ai', 'fusion_enrollment_year': config['enrollmentYear']})
        context = QueryContext(token=config['key'])
        session = _ObservedSession((self.session_factory or Session)(), judgement=source == 'ai' and config['type'] == 'judgement')
        try:
            if source == 'ai':
                ai = config['ai']
                bank = AIBank(host=ai['baseUrl'], api_key=config['key'], model=ai['model'], style=ai['type'],
                              timeout=UPSTREAM_TIMEOUT, store=None, session=session, cache=None)
            else:
                # Explicitly override BOTH potential credential sources. Host, endpoint and request
                # data remain the original Tiku168 implementation; no default embedded key is used.
                bank = Tiku168Bank(api_key=config['key'], token=config['key'], timeout=UPSTREAM_TIMEOUT,
                                   session=session, cache=None)
            try:
                result = bank.query(question, context)
            except Exception as exc:
                if session.failure is not None:
                    raise session.failure from None
                if isinstance(exc, exceptions.TokenInvalidError):
                    raise BridgeError('upstream_auth_failed') from None
                if isinstance(exc, exceptions.InsufficientQuotaError):
                    raise BridgeError('upstream_quota_failed') from None
                if isinstance(exc, exceptions.ServerUnavailableError):
                    raise BridgeError('upstream_unavailable') from None
                raise BridgeError('upstream_query_failed') from None
            if session.failure is not None:
                raise session.failure
            if not session.responses:
                raise BridgeError('upstream_response_missing')
            body = session.responses[-1]
            if source == 'original-bank':
                if type(body.get('code')) is not int or body['code'] != 0:
                    raise BridgeError('upstream_reported_error')
                remote_result = body.get('result')
                if not isinstance(remote_result, dict) or type(remote_result.get('success')) is not bool:
                    raise BridgeError('upstream_response_ambiguous')
                if remote_result.get('error') not in (None, '', False, {}, []):
                    raise BridgeError('upstream_reported_error')
            else:
                # Nonstandard status codes have no verified success/miss semantics.
                # Never let a vendor's error-shaped response become answer:null fallback.
                if ('code' in body and body['code'] is not None) or body.get('success') is False or body.get('type') == 'error':
                    raise BridgeError('upstream_reported_error')
            # The original AI parser can turn a literal null into a generic Answer;
            # honor the explicit upstream null before interpreting that fallback.
            if ((source == 'original-bank' and _explicit_bank_miss(body))
                    or (source == 'ai' and (_strict_ai_null(body) or explicit_refusal(_ai_answer_value(body))))):
                return {'kind': 'miss', 'explicitMiss': True}
            # Honor a validated truth value independently of displayed option
            # order, including interfaces returning JSON booleans.
            if source == 'ai' and config['type'] == 'judgement':
                value = _ai_judgement_value(body)
                if value is not _UNSET:
                    return {'kind': 'hit', 'answer': value}
            if getattr(result, 'success', None) is True and getattr(result, 'answer', None) is not None:
                if source == 'ai' and explicit_refusal(getattr(result.answer, 'normalized', '') or getattr(result.answer, 'raw', '')):
                    return {'kind': 'miss', 'explicitMiss': True}
                return {'kind': 'hit', 'answer': _answer_for_gateway(result.answer, config)}
            raise BridgeError('upstream_answer_unavailable')
        except BridgeError:
            raise
        except Exception:
            raise BridgeError('upstream_query_failed') from None
        finally:
            session.close()


def explicit_refusal(answer):
    return isinstance(answer, str) and bool(re.match(
        r'^\s*(?:(?:很抱歉|抱歉|对不起)[，,。!！\s]*)?(?:我(?:暂时)?(?:不能|无法)(?:为你|为您)?(?:解答|回答|提供答案)|(?:暂时)?(?:无法|不能)(?:解答|回答|提供答案)|unable to answer|I (?:cannot|can\x27t) answer)', answer, re.I))


def install_short_answer_prompt():
    """Fill the shipped 1.3.0 prompt's missing public SHORT_ANSWER branch."""
    import core.question_bank.ai as ai
    from core.question_bank.models import QuestionType
    from functools import wraps
    original = ai.build_prompt
    if getattr(original, '_fusion_short_answer', False):
        return
    @wraps(original)
    def build_prompt(question):
        if question.qtype != QuestionType.SHORT_ANSWER:
            prompt = original(question)
        else:
            prompt = ('题目类型：简答题（答案为完整的字符串）\n题干：' + question.stem +
                '\n\n作答要点：\n- 用文字直接回答题目，保留必要的步骤和分段。\n'
                '- 最后一行必须是 JSON：{"answer": "答案正文"}。\n'
                '- 无法解答时返回 {"answer": null}，JSON 后不要附加文字。')
        if getattr(question, 'extra', {}).get('fusion_study_prompt'):
            course = str(getattr(question, 'course_name', '') or '当前课程').strip()[:500]
            student = student_description(question.extra.get('fusion_enrollment_year'))
            prompt = '我是一名' + student + '，这是[' + course + ']课上的题目。\n' + prompt
        return prompt
    build_prompt._fusion_short_answer = True
    ai.build_prompt = build_prompt


def install_routes(application, *, token, host, port, service=None):
    """Add routes to the original app; existing auth/middleware/lifespan/WS are preserved."""
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    if host != '127.0.0.1' or not isinstance(token, str) or not token:
        raise ValueError('integration routes require a loopback authenticated host')
    if service is None:
        install_short_answer_prompt()
    canonical = f'http://{host}:{port}'
    authority = f'{host}:{port}'
    service = service or OriginalSearchService()
    slots = threading.BoundedSemaphore(3)

    def response(value, status=200):
        return JSONResponse(value, status_code=status, headers={'Cache-Control': 'no-store',
                            'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'})

    def endpoint(source):
        async def handle(request: Request):
            try:
                supplied = request.headers.getlist('x-token')
                if len(supplied) != 1 or len(supplied[0]) > 4096 or not hmac.compare_digest(supplied[0].encode(), token.encode()):
                    raise BridgeError('local_auth_failed', 401)
                if (request.headers.get('host') != authority or request.headers.get('origin') not in (None, canonical)
                        or request.headers.get('sec-fetch-site') == 'cross-site'):
                    raise BridgeError('cross_origin_forbidden', 403)
                if request.headers.get('content-type', '').split(';', 1)[0].strip().lower() != 'application/json':
                    raise BridgeError('json_content_type_required', 415)
                declared = request.headers.get('content-length')
                if declared is not None:
                    try:
                        declared = int(declared)
                    except ValueError:
                        raise BridgeError('request_invalid', 400) from None
                    if declared < 0 or declared > MAX_BODY:
                        raise BridgeError('request_body_too_large', 413)
                body = bytearray()
                async with asyncio.timeout(10):
                    async for chunk in request.stream():
                        if len(body) + len(chunk) > MAX_BODY:
                            raise BridgeError('request_body_too_large', 413)
                        body.extend(chunk)
                try:
                    payload = json.loads(body)
                except (ValueError, UnicodeError):
                    raise BridgeError('request_json_invalid', 400) from None
                if not slots.acquire(blocking=False):
                    raise BridgeError('search_busy', 429)
                def perform():
                    try:
                        return service.query(source, payload)
                    finally:
                        slots.release()  # Remains held if a canceled client leaves its worker running.
                result = await asyncio.to_thread(perform)
                return response(result)
            except BridgeError as exc:
                return response({'error': {'code': exc.code}}, exc.status)
            except TimeoutError:
                return response({'error': {'code': 'request_timeout'}}, 408)
            except Exception:
                return response({'error': {'code': 'search_failed'}}, 502)
        return handle

    for source in ('original-bank', 'ai'):
        application.add_api_route('/api/integration/' + source, endpoint(source), methods=['POST'],
                                  include_in_schema=False)
        # The shipped app mounts its HTML at '/'. Routes appended after that
        # catch-all never run (POST returns 405). Put only our exact routes first.
        route = application.router.routes.pop()
        application.router.routes.insert(0, route)
    return service
