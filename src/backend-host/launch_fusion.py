"""Installed app launcher: local initialization and detached GUI, no account import."""
import ctypes,datetime,json,os,pathlib,socket,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
def main():
    for name in ('private','evidence','lab-logs','bridge-data','instances','ocs-profile','ocs-profile/session'):
        (ROOT/name).mkdir(exist_ok=True)
    sys.path.insert(0,str(ROOT/'tools'))
    from run_integrated_backend import private_acl
    from network_policy import direct_environment
    for name in ('private','bridge-data','instances','ocs-profile'):
        private_acl(ROOT/name)
    ports=[18539]+([18540] if '--debug' in sys.argv else [])
    probes=[]
    try:
        for port in ports:
            sock=socket.socket();sock.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1);probes.append(sock);sock.bind(('127.0.0.1',port))
    except OSError:
        raise RuntimeError('融合版已运行，或所需本地端口正在使用。请先关闭已有融合版，再启动此副本。') from None
    finally:
        for sock in probes:sock.close()
    env=direct_environment()
    for key in ('ELECTRON_RUN_AS_NODE','OCS_POC_HEADLESS'):env.pop(key,None)
    env['OCS_FUSION_DEBUG']='1' if '--debug' in sys.argv else '0'
    env['OCS_FUSION_SOFTWARE_RENDER']='1' if '--software-rendering' in sys.argv else '0'
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    with (ROOT/'private'/('desktop-'+stamp+'.out')).open('wb') as out,(ROOT/'private'/('desktop-'+stamp+'.err')).open('wb') as err:
        child=subprocess.Popen([str(ROOT/'ocs-lab/XueBuTong.exe')],cwd=ROOT/'ocs-lab/resources/app',env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.DETACHED_PROCESS|subprocess.CREATE_NEW_PROCESS_GROUP)
    (ROOT/'evidence/fusion-launch.json').write_text(json.dumps({'pid':child.pid,'debug':env['OCS_FUSION_DEBUG']=='1','startedAt':stamp}),encoding='utf-8')
    if sys.stdout:print('FUSION_STARTED_PID',child.pid)
if __name__=='__main__':
    try:main()
    except Exception as error:
        message=str(error) if isinstance(error,RuntimeError) else '融合版启动失败。请确认安装目录可写，并查看该目录内的日志。'
        if sys.stderr:print(message,file=sys.stderr)
        else:ctypes.windll.user32.MessageBoxW(None,message,'学不通',0x10)
        sys.exit(1)
