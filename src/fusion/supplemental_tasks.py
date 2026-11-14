"""Course discussions and standard vote questionnaires.

Uses the platform's ordinary topic/form endpoints and the existing ordered search
gateway. Missing/unsupported prompts and misses remain manual; a reply/HTTP success
alone is never task completion. No exam endpoint or synthetic completion record.
"""
from copy import deepcopy
from functools import wraps
from html import unescape
from html.parser import HTMLParser
import re
from urllib.parse import quote, urlencode, urljoin, urlsplit
import uuid

MISS='所有搜题方式均未找到可用答案，请本人填写'
TYPES={'insertbbs':'discussion','inserttopic':'discussion','discussion':'discussion',
       'insertvote':'survey','vote':'survey','questionnaire':'survey','survey':'survey'}
DEFAULTS_KEY='_fusion_supplemental_defaults'

def text(value):
    return re.sub(r'\s+',' ',unescape(re.sub(r'<[^>]*>',' ',str(value or '')))).strip()

def manual_reason(title, options=(), kind='short'):
    return '' if text(title) else '未取得题目内容，请本人检查'

def checked_url(value, base=''):
    value=urljoin(base,value);url=urlsplit(value)
    if url.scheme!='https' or not (url.hostname or '').endswith('.chaoxing.com') or url.port not in (None,443) or url.username or url.password:
        raise ValueError('任务页面地址不受支持')
    return value

class Page(HTMLParser):
    def __init__(self,html):
        super().__init__(convert_charrefs=True);self.inputs={};self.discussion='';self.token='';self.in_script=False;self.feed(html)
    def handle_starttag(self,tag,pairs):
        attrs=dict(pairs)
        if tag=='script':self.in_script=True
        if tag=='input':self.inputs[attrs.get('id') or attrs.get('name') or '']=attrs.get('value','')
        if attrs.get('id')=='topicMainDiv':self.discussion=attrs.get('data','')
    def handle_endtag(self,tag):
        if tag=='script':self.in_script=False
    def handle_data(self,data):
        if self.in_script and re.search(r'window\.obj\s*=',data):
            match=re.search(r'''["']?urlToken["']?\s*:\s*(["'])([A-Za-z0-9_-]{16,512})\1''',data)
            if match:self.token=match[2]

def context(task, runner):
    defaults=task.extra.get(DEFAULTS_KEY) or {};ctx=getattr(runner,'context',{}) or {}
    return {'courseid':str(ctx.get('course_id') or defaults.get('courseid') or ''),
            'clazzId':str(ctx.get('clazz_id') or defaults.get('clazzId') or ''),
            'knowledgeid':str(task.chapter_id),'cpi':str(ctx.get('cpi') or defaults.get('cpi') or ''),
            'ktoken':str(defaults.get('ktoken') or ''),'userid':str(defaults.get('userid') or '')}

class Executor:
    def __init__(self,session,store,host='https://mooc1-api.chaoxing.com',timeout=20):
        self.session,self.store,self.host,self.timeout=session,store,host,timeout
    def get(self,url):
        response=self.session.get(checked_url(url),timeout=self.timeout)
        response.raise_for_status();checked_url(response.url)
        if len(response.content)>4*1024*1024:raise ValueError('任务页面过大')
        return response
    def manual(self,task,reason):
        from core.scheduler import TaskResult
        task.extra['manual_required']=True;task.extra['manual_reason']=reason
        return TaskResult(success=False,finished=False,message='待人工处理：'+reason)
    def execute(self,task,runner):
        from core.scheduler import TaskResult
        from answer_policy import KEY,SearchBatch,SearchFailure
        policy=self.store.get(KEY)
        if not policy:return self.manual(task,'请先在学不通配置题库或 AI')
        task.extra=dict(task.extra or {},completion_verified=False)
        task.extra.pop('manual_required',None);task.extra.pop('manual_reason',None)
        if not runner.wait_if_paused():return TaskResult(success=False,finished=False,cancelled=True,message='任务已停止')
        # Questionnaires/discussions must never consume the random-answer options.
        state={**deepcopy(policy),'runner':runner,'queried':0,'found':0}
        state['settings']['randomWork-choice']=False;state['settings']['randomWork-complete']=False
        batch=SearchBatch(state)
        try:
            if task.task_type=='discussion':return self.discussion(task,runner,state,batch)
            return self.survey(task,runner,state,batch)
        except SearchFailure:
            return self.manual(task,'搜题连接异常，未保存或提交，请检查连接后重试')
        except Exception:
            return self.manual(task,'任务页面读取或提交未确认，请打开课程检查；未标记完成')
        finally:batch.close()
    def query(self,batch,title,kind='short',options=(),blank_count=0):
        from core.question_bank.models import Question,QuestionType
        from answer_policy import TYPES
        code=next(k for k,v in TYPES.items() if v==kind)
        return batch.query(Question(stem=title,qtype=QuestionType(code),options=list(options),answer_num=blank_count),None)
    def confirm(self,task,runner):
        from core.taskpoint import fetch_task_points
        ctx=context(task,runner);job=str(task.extra.get('job_id') or (task.extra.get('property') or {}).get('jobid') or '')
        points=fetch_task_points(self.session,course_id=ctx['courseid'],clazz_id=ctx['clazzId'],chapter_id=task.chapter_id,cpi=ctx['cpi'])
        matched=[point for point in points if str(point.extra.get('job_id') or (point.extra.get('property') or {}).get('jobid') or '')==job]
        verified=bool(job and len(matched)==1 and (matched[0].finished or matched[0].extra.get('isPassed') is True))
        task.extra['completion_verified']=verified
        return verified
    def finish(self,task,runner,message):
        from core.scheduler import TaskResult
        done=self.confirm(task,runner)
        return TaskResult(success=True,finished=done,message=message+('，平台已确认完成' if done else '，任务点仍待平台确认'))
    def discussion(self,task,runner,state,batch):
        from core.scheduler import TaskResult
        prop=task.extra.get('property') or {};ctx=context(task,runner)
        reason=manual_reason(prop.get('title') or task.name)
        if reason:return self.manual(task,reason)
        params={**ctx,'mtopicid':str(prop.get('mid') or task.extra.get('mid') or ''),
                'jobid':str(task.extra.get('job_id') or prop.get('jobid') or ''),'isPortal':'false','ut':'s','isJob':'true'}
        for key in ('cpi','ktoken','userid'):params.pop(key,None)
        url=self.host+'/mooc-ans/bbscircle/chapter?'+urlencode(params)
        page=Page(self.get(url).text)
        if page.inputs.get('isFinished')=='true':
            task.extra['completion_verified']=True
            return TaskResult(success=True,finished=True,message='讨论任务已由平台确认完成')
        link=checked_url(page.discussion,url)
        ids=re.search(r'/course/topic/v3/bbs/([a-f0-9]{32})/([a-f0-9]{32})/replysList',urlsplit(link).path)
        if not ids:return self.manual(task,'暂不支持此讨论页面，请本人处理')
        origin=urlsplit(link);base=origin.scheme+'://'+origin.netloc;topic_id=ids[2]
        topic=self.get(base+'/course/topic/'+topic_id+'/getTopic?screenStatus=0').json()
        if topic.get('status') is not True or not isinstance(topic.get('datas'),dict):return self.manual(task,'讨论暂不可访问，请本人检查')
        data=topic['datas'];title=text(data.get('title'))+' '+text(data.get('rtf_content') or data.get('text_content'))
        reason=manual_reason(title)
        if reason:return self.manual(task,reason)
        if data.get('lock_reply') not in (None,False,0,'0') or (data.get('userAuth') or {}).get('operationAuth',{}).get('reply')!=1:
            return self.manual(task,'讨论当前不允许回复')
        result=self.query(batch,title)
        if not result.success:return self.manual(task,MISS)
        answer=result.answer.normalized or result.answer.raw
        minimum=int(prop.get('replywordnum') or 0)
        if len(text(answer))<minimum:return self.manual(task,'搜到的答案未达到讨论要求的最少字数')
        upload=state['settings']['upload']
        if upload in ('save','nomove'):
            return self.manual(task,'已找到参考答案；讨论不支持草稿保存，当前提交设置不允许发布')
        # Persist an intent before sending. Reopening/retrying never duplicates a
        # possibly accepted public reply; platform completion is checked separately.
        key='integration.discussion_submission.'+topic_id
        if self.store.get(key):return self.finish(task,runner,'此前已尝试回复，请本人核对，未重复发布')
        if not runner.sleep(state['settings']['stopSecondWhenFinish']):return TaskResult(success=False,finished=False,cancelled=True,message='任务已停止，未回复')
        token=Page(self.get(link).text).token
        if not token:return self.manual(task,'讨论页面未提供有效的提交凭据，请本人打开页面检查；未发布回复')
        self.store.set(key,{'state':'pending'})
        response=self.session.post(base+'/pc/invitation/'+topic_id+'/addReplys',data={
            'courseId':ctx['courseid'],'classId':ctx['clazzId'],'bbsid':ids[1],'urlToken':token,'replyId':'-1','uuid':str(uuid.uuid4()),
            'topic_content':quote(answer,safe="~!*()'"),'files_url':'','files_attr':'','anonymous':''},
            headers={'Accept':'application/json, text/javascript, */*; q=0.01','X-Requested-With':'XMLHttpRequest','Origin':base,'Referer':link},timeout=self.timeout)
        response.raise_for_status();body=response.json()
        if body.get('status') is not True or not (body.get('datas') or {}).get('reply'):
            reason=text(body.get('msg'))[:200]+'；' if body.get('status') is False and body.get('msg') else ''
            return self.manual(task,reason+'回复未获平台确认，请本人核对后再处理，未自动重复发布')
        self.store.set(key,{'state':'accepted'})
        return self.finish(task,runner,'已使用搜题结果回复讨论')
    def survey(self,task,runner,state,batch):
        from core import work
        from core.scheduler import TaskResult
        from answer_policy import TYPES
        prop=task.extra.get('property') or {};ctx=context(task,runner)
        if prop.get('module') not in ('insertvote','vote'):
            return self.manual(task,'此问卷使用独立问卷系统，请本人打开填写')
        params={**ctx,'api':'1','workId':str(prop.get('id') or prop.get('workid') or ''),
                'jobid':str(task.extra.get('job_id') or prop.get('jobid') or ''),'needRedirect':'true',
                'type':'vote','ut':'s','votetype':'1','isjob':'true','enc':str(task.extra.get('enc') or '')}
        params.pop('cpi',None);params.pop('userid',None)
        response=self.get(self.host+'/mooc-ans/api/work?'+urlencode(params));task.extra['task_url']=response.url
        form=work.parse_work_page(response.text)
        if work.page_is_graded(response.text):return self.finish_survey(task,runner)
        if not form.action or not form.questions:return self.manual(task,'未识别此问卷的可答题表单，请本人处理')
        checked_url(form.action,response.url)
        for q in form.questions:
            reason=manual_reason(q.stem,q.options,TYPES.get(q.qtype,'unknown'))
            if reason:return self.manual(task,reason)
            if q.qtype not in TYPES:return self.manual(task,'问卷包含暂不支持的题型')
        state['form']=form;answers={}
        for q in form.questions:
            result=self.query(batch,q.stem,TYPES[q.qtype],q.options,q.answer_num)
            if not result.success:return self.manual(task,MISS)
            action=work.build_answer_action(q,result.answer,option_values=q.option_values)
            if not action:return self.manual(task,'答案无法匹配问卷选项，请本人检查')
            answers[q.question_id]=action
        upload=state['settings']['upload']
        if upload=='nomove':return self.manual(task,'已完成搜题，当前设置不保存或提交')
        if not runner.sleep(state['settings']['stopSecondWhenFinish']):return TaskResult(success=False,finished=False,cancelled=True,message='任务已停止，未提交问卷')
        submit=upload!='save';fields=work.apply_answers(form,answers)
        # No blind retry of a questionnaire write.
        result=work.submit_work(self.session,form,fields,submit=submit,base_url=response.url,referer=response.url,timeout=self.timeout,retries=0)
        if not result.ok:return self.manual(task,'问卷保存或提交未获确认，请本人核对')
        if not submit:return TaskResult(success=True,finished=False,message='问卷答案已保存，尚未提交')
        # The form endpoint can acknowledge a save without a final submission.
        # Only the reread submitted page permits the platform's normal vote
        # completion callback, exactly as the interactive module does.
        if not work.page_is_graded(self.get(response.url).text):
            return self.manual(task,'问卷提交状态仍待平台确认，请打开课程核对')
        return self.finish_survey(task,runner)
    def finish_survey(self,task,runner):
        ctx=context(task,runner);token=task.extra.get('jtoken')
        if not token:return self.manual(task,'问卷已提交，但任务确认参数缺失，请打开课程核对')
        params={'jobid':str(task.extra.get('job_id') or ''),'knowledgeid':task.chapter_id,
                'courseid':ctx['courseid'],'clazzid':ctx['clazzId'],'jtoken':str(token),
                'checkMicroTopic':'true','microTopicId':str(task.extra.get('microTopicId') or '0')}
        response=self.get(self.host+'/mooc-ans/job/vote?'+urlencode(params)).json()
        if response.get('status') is not True:return self.manual(task,'问卷已提交，但平台未确认任务完成')
        return self.finish(task,runner,'问卷已提交')

def install(store):
    from core import taskpoint,pipeline
    if getattr(taskpoint,'_fusion_supplemental_tasks',False):return
    original_points=taskpoint.parse_task_points
    @wraps(original_points)
    def points(data,*args,**kwargs):
        prepared=data
        if isinstance(data,dict):
            prepared=dict(data,attachments=[])
            for attachment in data.get('attachments',[]):
                kind=TYPES.get((attachment.get('property') or {}).get('module'))
                # Give the upstream parser a recognized base type so it does not
                # emit a false "unsupported" warning before our executor runs.
                prepared['attachments'].append(dict(attachment,type='discussion' if kind=='discussion' else 'workid') if kind else attachment)
        rows=original_points(prepared,*args,**kwargs)
        for task in rows:
            extra=task.extra or {};prop=extra.get('property') or {};kind=TYPES.get(prop.get('module')) or TYPES.get(task.task_type)
            if not kind:continue
            task.task_type=kind
            defaults=data.get('defaults',{}) if isinstance(data,dict) else {}
            task.extra={**extra,DEFAULTS_KEY:{k:defaults[k] for k in ('courseid','clazzId','knowledgeid','cpi','ktoken','userid') if k in defaults}}
        return rows
    taskpoint.parse_task_points=points
    original_factory=pipeline.default_executors
    @wraps(original_factory)
    def factory(session,*args,**kwargs):
        result=original_factory(session,*args,**kwargs);executor=Executor(session,store,kwargs.get('host','https://mooc1-api.chaoxing.com'),kwargs.get('timeout',20))
        result.update(discussion=executor,survey=executor)
        return result
    pipeline.default_executors=factory;taskpoint._fusion_supplemental_tasks=True
