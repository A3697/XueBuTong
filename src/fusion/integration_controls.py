"""Per-account run preferences shared by the local panel and OCS monitor."""
import hmac
import math

DEFAULTS={'beisu':1,'vgqtlv':85,'auto_submit':True,'ignore_progress':False}

def run_options(store):
    result={key:store.get('config.'+key,default) for key,default in DEFAULTS.items()}
    policy=store.get('config.fusion_answer_policy') or {}
    upload=policy.get('settings',{}).get('upload')
    if upload is not None:
        result['vgqtlv']=upload if type(upload) is int else 0 if upload=='force' else 100
        result['auto_submit']=type(upload) is int or upload=='force'
    return result

def submission_summary(store):
    policy=store.get('config.fusion_answer_policy') or {}
    upload=policy.get('settings',{}).get('upload')
    return {'managed':upload is not None,'upload':upload,
            'applies':'next_test','source':'main_window'}

def install_routes(application, *, token, host, port, store, state=None):
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    canonical=f'http://{host}:{port}'
    def authorized(request):
        values=request.headers.getlist('x-token')
        hosts=request.headers.getlist('host')
        origins=request.headers.getlist('origin')
        return (len(values)==1 and hmac.compare_digest(values[0].encode(),token.encode())
                and hosts==[f'{host}:{port}']
                and (not origins or origins==[canonical]))
    async def handle(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if request.method=='PUT':
            try:
                raw=await request.body()
                if len(raw)>4096:raise ValueError()
                import json
                body=json.loads(raw)
                if not isinstance(body,dict):raise ValueError()
                result={}
                for key,default in DEFAULTS.items():
                    value=body.get(key,store.get('config.'+key,default))
                    if isinstance(default,bool):
                        if type(value) is not bool:raise ValueError()
                    elif type(value) not in (int,float) or not math.isfinite(value) or not (1<=value<=1000 if key=='beisu' else 0<=value<=100):raise ValueError()
                    result[key]=value
                for key,value in result.items():
                    if key not in ('vgqtlv','auto_submit'):store.set('config.'+key,value)
            except Exception:
                return JSONResponse({'error':'run_options_invalid'},status_code=400)
        result=run_options(store)
        return JSONResponse(result,headers={'Cache-Control':'no-store'})
    application.add_api_route('/api/integration/run-options',handle,methods=['GET','PUT'],include_in_schema=False)
    route=application.router.routes.pop();application.router.routes.insert(0,route)

    async def playback(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is None:
            return JSONResponse({'error':'integration_state_unavailable'},status_code=503)
        if request.method=='PUT':
            try:
                raw=await request.body()
                if len(raw)>4096:raise ValueError()
                import json
                body=json.loads(raw)
                if not isinstance(body,dict) or set(body)!={'beisu'}:raise ValueError()
                result=state.set_playback(body['beisu'])
            except (ValueError,TypeError,KeyError,UnicodeError):
                return JSONResponse({'error':'playback_invalid'},status_code=400)
        else:
            result=state.playback()
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    async def monitor_progress(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is None:
            return JSONResponse({'error':'integration_state_unavailable'},status_code=503)
        return JSONResponse(state.monitor_progress(),headers={'Cache-Control':'no-store'})

    async def homeworks(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is None:
            return JSONResponse({'error':'integration_state_unavailable'},status_code=503)
        try:
            index=int(request.path_params['index'])
        except (KeyError,ValueError,TypeError):
            return JSONResponse({'error':'queue_index_invalid'},status_code=400)
        try:
            result=state.homework_tasks(index)
        except IndexError:
            return JSONResponse({'error':'queue_item_unavailable'},status_code=404)
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    async def completion(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is None:
            return JSONResponse({'error':'integration_state_unavailable'},status_code=503)
        from starlette.concurrency import run_in_threadpool
        from course_completion import read_completion
        try:
            result = await run_in_threadpool(read_completion, state.engine,
                request.query_params.get('course_id',''), request.query_params.get('clazz_id',''),
                request.query_params.get('homework') == '1')
        except KeyError:
            return JSONResponse({'error':'course_unavailable'},status_code=404)
        except Exception:
            return JSONResponse({'error':'course_progress_unavailable'},status_code=502)
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    async def prune_pending(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is None:
            return JSONResponse({'error':'integration_state_unavailable'},status_code=503)
        try:
            body=await request.json()
            if not isinstance(body,dict) or set(body)!={'course_id','clazz_id'} or any(not isinstance(v,str) or len(v)>128 for v in body.values()):
                raise ValueError()
        except (ValueError,TypeError):
            return JSONResponse({'error':'course_invalid'},status_code=400)
        result=state.engine.prune_unstarted(body['course_id'],body['clazz_id'])
        return JSONResponse(result,headers={'Cache-Control':'no-store'})

    async def answer_policy(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        from answer_policy import KEY, validate
        try:
            raw = await request.body()
            if len(raw) > 131072:
                raise ValueError('too_large')
            import json
            policy = validate(json.loads(raw))
            store.set(KEY, policy)
            if state is not None:
                state.engine._emit_fn({'type':'integration.submission-settings',
                                      'payload':submission_summary(store)})
        except (ValueError, TypeError, KeyError, UnicodeError):
            return JSONResponse({'error':'answer_policy_invalid'},status_code=400)
        return JSONResponse({'saved':True},headers={'Cache-Control':'no-store'})

    async def cancel_recovery(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        if state is not None:
            cancel = getattr(state.engine, '_fusion_cancel_recovery', None)
            if cancel:
                cancel()
            state.engine._emit_fn({'type':'integration.recovery-cancel','payload':{}})
        return JSONResponse({'cancelled':True},headers={'Cache-Control':'no-store'})

    async def submission(request: Request):
        if not authorized(request):
            return JSONResponse({'error':'local_auth_failed'},status_code=403)
        return JSONResponse(submission_summary(store),headers={'Cache-Control':'no-store'})

    for path,handler,methods in (
            ('/api/integration/recovery/cancel',cancel_recovery,['POST']),
            ('/api/integration/queue/prune-pending',prune_pending,['POST']),
            ('/api/integration/answer-policy',answer_policy,['PUT']),
            ('/api/integration/submission-settings',submission,['GET']),
            ('/api/integration/course-completion',completion,['GET']),
            ('/api/integration/playback',playback,['GET','PUT']),
            ('/api/integration/monitor-progress',monitor_progress,['GET']),
            ('/api/integration/queue/{index}/homeworks',homeworks,['GET'])):
        application.add_api_route(path,handler,methods=methods,include_in_schema=False)
        route=application.router.routes.pop();application.router.routes.insert(0,route)
