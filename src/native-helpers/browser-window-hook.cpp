#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shobjidl.h>
#include <propkey.h>
#include <propvarutil.h>
#include <string>

#ifdef XBT_GUARD_TRACE
#include <cstdio>
static void Trace(HWND window,UINT message,WPARAM wp,LPARAM lp,const char* stage){
    HMODULE module=nullptr;wchar_t path[32768]={};
    GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&Trace),&module);
    GetModuleFileNameW(module,path,32768);std::wstring file=path;file=file.substr(0,file.find_last_of(L"\\/")+1)+L"guard-trace-"+std::to_wstring(GetCurrentProcessId())+L".log";
    FILE* output=nullptr;if(_wfopen_s(&output,file.c_str(),L"a")==0&&output){
        fprintf(output,"%llu %s hwnd=%p message=%u wp=%llu lp=%lld visible=%d proc=%p\n",GetTickCount64(),stage,window,message,static_cast<unsigned long long>(wp),static_cast<long long>(lp),IsWindowVisible(window),reinterpret_cast<void*>(GetWindowLongPtrW(window,GWLP_WNDPROC)));fclose(output);
    }
}
#else
static void Trace(HWND,UINT,WPARAM,LPARAM,const char*){}
#endif

// These thread hooks are installed only in the exact browser process launched
// by this app. Keep Chrome's native frame, tabs, geometry and document intact.
static constexpr UINT_PTR kSubclass=0x58544247;
static constexpr ULONG_PTR kIdentity=0x58544249;
static const wchar_t* kProperty=L"XueBuTong.BrowserWindowGuard.v4";
static const wchar_t* kAppId=L"XueBuTong.Desktop";
static bool g_enabled=true;
static UINT AttachMessage(){static UINT value=RegisterWindowMessageW(L"XueBuTong.AttachBrowserGuard.v4");return value;}
static UINT ShowMessage(){static UINT value=RegisterWindowMessageW(L"XueBuTong.ShowBrowserGuard.v4");return value;}
static UINT ReleaseMessage(){static UINT value=RegisterWindowMessageW(L"XueBuTong.ReleaseBrowserGuard.v4");return value;}
struct WindowState {
    std::wstring originalTitle;
    std::wstring title=L"学不通 · 待确认登录姓名";
    PROPVARIANT originalAppId{};
    bool appIdSaved=false;
    ~WindowState(){PropVariantClear(&originalAppId);}
};
static bool IsBrowserFrame(HWND window){
    wchar_t name[96]={};
    return IsWindow(window)&&GetAncestor(window,GA_ROOT)==window&&GetClassNameW(window,name,96)&&wcscmp(name,L"Chrome_WidgetWin_1")==0&&(GetWindowLongPtrW(window,GWL_STYLE)&WS_CAPTION)==WS_CAPTION;
}
static bool ApplyAppId(HWND window,WindowState* state,bool restore=false){
    IPropertyStore* store=nullptr;
    if(FAILED(SHGetPropertyStoreForWindow(window,IID_PPV_ARGS(&store))))return false;
    if(!state->appIdSaved){state->appIdSaved=SUCCEEDED(store->GetValue(PKEY_AppUserModel_ID,&state->originalAppId));}
    if(!restore){
        PROPVARIANT current{};
        const bool unchanged=SUCCEEDED(store->GetValue(PKEY_AppUserModel_ID,&current))&&current.vt==VT_LPWSTR&&current.pwszVal&&wcscmp(current.pwszVal,kAppId)==0;
        PropVariantClear(&current);
        if(unchanged){store->Release();return true;}
    }
    PROPVARIANT value{};HRESULT result=E_FAIL;
    if(restore)result=store->SetValue(PKEY_AppUserModel_ID,state->originalAppId);
    else if(SUCCEEDED(InitPropVariantFromString(kAppId,&value)))result=store->SetValue(PKEY_AppUserModel_ID,value);
    PropVariantClear(&value);store->Release();return SUCCEEDED(result);
}
static LRESULT CALLBACK BrowserFrameProc(HWND window,UINT message,WPARAM wp,LPARAM lp,UINT_PTR,DWORD_PTR data){
    auto* state=reinterpret_cast<WindowState*>(data);
    if(message==WM_NCLBUTTONDOWN||message==WM_NCLBUTTONUP||message==WM_LBUTTONDOWN||message==WM_LBUTTONUP||message==WM_CLOSE||message==WM_SYSCOMMAND||message==WM_DESTROY||message==WM_NCDESTROY||message==WM_SHOWWINDOW||message==ReleaseMessage())Trace(window,message,wp,lp,"subclass");
    // Chrome may translate its custom caption input into client WM_LBUTTONUP;
    // either route can destroy the browser without WM_CLOSE or SC_CLOSE.
    bool captionClose=(message==WM_NCLBUTTONDOWN||message==WM_NCLBUTTONUP||message==WM_NCLBUTTONDBLCLK)&&wp==HTCLOSE;
    if(message==WM_LBUTTONDOWN||message==WM_LBUTTONUP||message==WM_LBUTTONDBLCLK){
        POINT point{GET_X_LPARAM(lp),GET_Y_LPARAM(lp)};
        if(ClientToScreen(window,&point))captionClose=DefSubclassProc(window,WM_NCHITTEST,0,MAKELPARAM(point.x,point.y))==HTCLOSE;
    }
    const bool altF4=message==WM_SYSKEYDOWN&&wp==VK_F4&&(lp&(1LL<<29));
    if(captionClose||altF4||message==WM_CLOSE||(message==WM_SYSCOMMAND&&(wp&0xfff0)==SC_CLOSE)){
        ShowWindow(window,SW_HIDE);
        Trace(window,message,wp,lp,"hidden");
        return 0;
    }
    if(message==ShowMessage()){
        // Restore on Chrome's own UI/DPI thread. SW_SHOW alone can leave its
        // native frame visible before the renderer has received restoration.
        const int command=IsIconic(window)?SW_RESTORE:IsZoomed(window)?SW_SHOWMAXIMIZED:SW_SHOWNORMAL;
        ShowWindow(window,command);
        SetForegroundWindow(window);
        return 1;
    }
    if(message==AttachMessage()){ApplyAppId(window,state);return 1;}
    if(message==WM_COPYDATA&&lp){
        const auto* copy=reinterpret_cast<const COPYDATASTRUCT*>(lp);
        if(copy->dwData==kIdentity&&copy->lpData&&copy->cbData>=sizeof(wchar_t)&&copy->cbData<=512&&copy->cbData%sizeof(wchar_t)==0){
            const auto* value=static_cast<const wchar_t*>(copy->lpData);const size_t length=copy->cbData/sizeof(wchar_t);
            if(value[length-1]==L'\0'){
                const std::wstring next=value[0]?L"学不通 · "+std::wstring(value):L"学不通 · 待确认登录姓名";
                if(state->title!=next){state->title=next;DefSubclassProc(window,WM_SETTEXT,0,reinterpret_cast<LPARAM>(state->title.c_str()));}
                return 1;
            }
        }
    }
    if(message==WM_SETTEXT){
        state->originalTitle=lp?reinterpret_cast<const wchar_t*>(lp):L"";
        return DefSubclassProc(window,message,wp,reinterpret_cast<LPARAM>(state->title.c_str()));
    }
    if(message==ReleaseMessage()){
        g_enabled=false;
        ApplyAppId(window,state,true);
        DefSubclassProc(window,WM_SETTEXT,0,reinterpret_cast<LPARAM>(state->originalTitle.c_str()));
        RemovePropW(window,kProperty);RemoveWindowSubclass(window,BrowserFrameProc,kSubclass);delete state;
        return 1;
    }
    if(message==WM_DESTROY)ApplyAppId(window,state,true);
    if(message==WM_NCDESTROY){
        RemovePropW(window,kProperty);RemoveWindowSubclass(window,BrowserFrameProc,kSubclass);delete state;
    }
    return DefSubclassProc(window,message,wp,lp);
}
extern "C" __declspec(dllexport) LRESULT CALLBACK GuardHook(int code,WPARAM wp,LPARAM lp){
    if(code>=0&&lp){
        const CWPSTRUCT* message=reinterpret_cast<const CWPSTRUCT*>(lp);
        if(g_enabled&&(message->message==AttachMessage()||message->message==WM_SHOWWINDOW||message->message==WM_CREATE)
            &&IsBrowserFrame(message->hwnd)&&!GetPropW(message->hwnd,kProperty)){
            HMODULE module=nullptr;
            GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_PIN,reinterpret_cast<LPCWSTR>(&BrowserFrameProc),&module);
            auto* state=new WindowState();wchar_t title[4096]={};GetWindowTextW(message->hwnd,title,4096);state->originalTitle=title;
            if(SetWindowSubclass(message->hwnd,BrowserFrameProc,kSubclass,reinterpret_cast<DWORD_PTR>(state))){
                Trace(message->hwnd,message->message,message->wParam,message->lParam,"attached");
                SetPropW(message->hwnd,kProperty,reinterpret_cast<HANDLE>(1));ApplyAppId(message->hwnd,state);
                SetWindowTextW(message->hwnd,title);
            }else delete state;
        }
    }
    return CallNextHookEx(nullptr,code,wp,lp);
}
BOOL WINAPI DllMain(HINSTANCE,DWORD,LPVOID){return TRUE;}
