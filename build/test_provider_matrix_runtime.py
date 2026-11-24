"""Actual protected 1.3.1 AI parsers with deterministic HTTP responses; no network."""
import copy
import html.parser
import json
import logging
import os
from pathlib import Path
import socket
import sys
import tempfile
import unittest

SOURCE=Path(__file__).resolve().parents[1]
RUNTIME=Path(os.environ['XBT_RUNTIME_ROOT'])/'star-runtime'
RECORD=Path(os.environ['XBT_QA_ROOT'])
DATA=Path(tempfile.mkdtemp(prefix='provider-matrix-',dir=RECORD))
sys.dont_write_bytecode=True
sys.path[:0]=[str(SOURCE/'src/fusion'),str(RUNTIME)]
DLLS=[os.add_dll_directory(str(p)) for p in {RUNTIME,*[p.parent for p in RUNTIME.rglob('*.pyd')]}]
os.chdir(DATA)
def blocked(*args,**kwargs):raise RuntimeError('Offline provider fixture forbids network')
socket.socket.connect=socket.socket.connect_ex=socket.create_connection=blocked
import core.paths
core.paths.user_data_dir=lambda: DATA
import requests
from original_search_bridge import OriginalSearchService,BridgeError,install_short_answer_prompt
install_short_answer_prompt()

CASES=[('single',[{'label':'A','text':'甲'},{'label':'B','text':'乙'}],'B','B',0),
       ('multiple',[{'label':'A','text':'甲'},{'label':'B','text':'乙'},{'label':'C','text':'丙'}],['A','C'],'AC',0),
       ('judgement',[{'label':'A','text':'错误'},{'label':'B','text':'正确'}],True,'对',0),
       ('completion',[],['北京','上海'],['北京','上海'],2),
       ('short',[],'结合课程概念给出完整回答','结合课程概念给出完整回答',0)]
def envelope(style,answer):
    text=json.dumps({'answer':answer},ensure_ascii=False)
    return {'openai':{'choices':[{'message':{'content':text}}]},
            'auto':{'choices':[{'message':{'content':text}}]},
            'anthropic':{'content':[{'type':'text','text':text}]},
            'gemini':{'candidates':[{'content':{'parts':[{'text':text}]}}]},
            'ollama':{'message':{'content':text}}}[style]

class Matrix(unittest.TestCase):
    def run_query(self,style,case,answer=None,status=200,body=None,fault=None,source='ai'):
        kind,options,raw,expected,blanks=case
        calls=[];closed=[]
        class Session(requests.Session):
            def request(self,method,url,**kwargs):
                calls.append({'method':method,'url':url,'data':kwargs})
                if fault:raise fault
                response=requests.Response();response.status_code=status;response.url=url
                value=body if body is not None else envelope(style,answer)
                response._content=(value if isinstance(value,str) else json.dumps(value,ensure_ascii=False)).encode('utf-8')
                response.encoding='utf-8';return response
            def close(self):closed.append(True);super().close()
        service=OriginalSearchService(session_factory=Session)
        payload={'title':'离线验收 '+kind,'type':kind,'options':copy.deepcopy(options),'key':'' if style=='ollama' else 'fixture-secret',
                 'blankCount':blanks,'courseName':'合成测试课程','enrollmentYear':2025,
                 'ai':{'model':'fixture-model','baseUrl':'http://127.0.0.1:12345/v1','type':style}}
        try:return service.query(source,payload),calls
        finally:self.assertTrue(closed,'every request must release its own session')

    def test_all_ai_interfaces_and_question_types_twice(self):
        for repeat in range(2):
            for style in ('openai','anthropic','gemini','ollama','auto'):
                for case in CASES:
                    with self.subTest(repeat=repeat,style=style,type=case[0]):
                        result,calls=self.run_query(style,case,case[2])
                        self.assertEqual(result,{'kind':'hit','answer':case[3]})
                        self.assertEqual(len(calls),1)
                        serialized=json.dumps(calls,ensure_ascii=False)
                        self.assertIn('合成测试课程',serialized)
                        self.assertIn('大二学生',serialized)

    def test_null_and_explicit_refusal_are_misses_for_every_interface(self):
        for style in ('openai','anthropic','gemini','ollama','auto'):
            for answer in (None,'无法解答','抱歉，我无法回答这个问题'):
                with self.subTest(style=style,answer=answer):self.assertEqual(self.run_query(style,CASES[-1],answer)[0],{'kind':'miss','explicitMiss':True})

    def test_judgment_json_booleans_do_not_depend_on_displayed_option_order(self):
        for style in ('openai','anthropic','gemini','ollama','auto'):
            for answer,expected in ((True,'对'),(False,'错'),('对','对'),('错误','错'),('true','对'),('false','错')):
                with self.subTest(style=style,answer=answer):
                    result,calls=self.run_query(style,CASES[2],answer)
                    self.assertEqual(result,{'kind':'hit','answer':expected})
                    self.assertEqual(len(calls),1)
            with self.subTest(style=style),self.assertRaises(BridgeError):self.run_query(style,CASES[2],'不确定')

    def test_auth_rate_limit_server_network_and_bad_json_are_never_misses(self):
        for style in ('openai','anthropic','gemini','ollama','auto'):
            for status in (401,403,429,500):
                with self.subTest(style=style,status=status),self.assertRaises(BridgeError):self.run_query(style,CASES[0],'B',status=status)
            for body in ('broken',{}, {'error':'fixture'}, {'choices':[{'message':{'content':'not JSON'}}]}):
                with self.subTest(style=style,body=body),self.assertRaises(BridgeError):self.run_query(style,CASES[0],body=body)
            for fault in (requests.Timeout('fixture'),requests.ConnectionError('fixture')):
                with self.subTest(style=style,fault=type(fault).__name__),self.assertRaises(BridgeError):self.run_query(style,CASES[0],fault=fault)

    def test_universal_bank_explicit_miss_and_error_boundary(self):
        self.assertEqual(self.run_query('openai',CASES[0],source='original-bank',body={'code':0,'result':{'success':False,'answers':[]}})[0],{'kind':'miss','explicitMiss':True})
        for body in ({'code':0,'result':{}},{'code':0,'result':{'success':False,'message':'余额不足'}},{'code':1,'result':{'success':False}},{}):
            with self.subTest(body=body),self.assertRaises(BridgeError):self.run_query('openai',CASES[0],source='original-bank',body=body)

if __name__=='__main__':
    try:unittest.main(verbosity=2)
    finally:logging.shutdown()
