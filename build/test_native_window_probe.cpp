#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <propkey.h>
#include <propvarutil.h>
#include <cstdio>
#include <cwchar>
#include <string>
#include <vector>

static std::string Json(const std::wstring& value) {
    std::string out="\"";
    int size=WideCharToMultiByte(CP_UTF8,0,value.data(),static_cast<int>(value.size()),nullptr,0,nullptr,nullptr);
    std::string utf8(size,'\0');
    WideCharToMultiByte(CP_UTF8,0,value.data(),static_cast<int>(value.size()),utf8.data(),size,nullptr,nullptr);
    for(unsigned char c:utf8){if(c=='"'||c=='\\')out+='\\';if(c<32){char hex[8];sprintf_s(hex,"\\u%04x",c);out+=hex;}else out+=c;}
    return out+'"';
}
int wmain(int argc,wchar_t** argv) {
    if(argc<4)return 2;
    const DWORD expected=wcstoul(argv[1],nullptr,10);
    HANDLE process=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,expected);
    if(!process)return 3;
    wchar_t image[32768]={};DWORD imageSize=32768;
    if(!QueryFullProcessImageNameW(process,0,image,&imageSize)||_wcsicmp(image,argv[2])){CloseHandle(process);return 4;}
    SetProcessDPIAware();CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    std::vector<HWND> windows;
    struct Selection {DWORD pid;std::vector<HWND>* windows;} selection{expected,&windows};
    EnumWindows([](HWND hwnd,LPARAM data)->BOOL{auto* selected=reinterpret_cast<Selection*>(data);DWORD pid=0;GetWindowThreadProcessId(hwnd,&pid);wchar_t name[100]={};if(pid==selected->pid&&GetClassNameW(hwnd,name,100)&&!wcscmp(name,L"Chrome_WidgetWin_1")&&(GetWindowLongPtrW(hwnd,GWL_STYLE)&WS_CAPTION))selected->windows->push_back(hwnd);return TRUE;},reinterpret_cast<LPARAM>(&selection));
    printf("{\"pid\":%lu,\"windows\":[",expected);bool first=true;
    for(HWND hwnd:windows){
        if(!first)printf(",");first=false;
        wchar_t title[4096]={};GetWindowTextW(hwnd,title,4096);RECT bounds{};GetWindowRect(hwnd,&bounds);
        POINT close{bounds.right-MulDiv(25,GetDpiForWindow(hwnd),96),bounds.top+MulDiv(18,GetDpiForWindow(hwnd),96)};
        DWORD_PTR hitValue=0;
        SendMessageTimeoutW(hwnd,WM_NCHITTEST,0,MAKELPARAM(close.x,close.y),SMTO_ABORTIFHUNG,1000,&hitValue);
        const LRESULT hit=static_cast<LRESULT>(hitValue);
        IPropertyStore* properties=nullptr;std::wstring appId;
        if(SUCCEEDED(SHGetPropertyStoreForWindow(hwnd,IID_PPV_ARGS(&properties)))){PROPVARIANT value{};if(SUCCEEDED(properties->GetValue(PKEY_AppUserModel_ID,&value))&&value.vt==VT_LPWSTR)appId=value.pwszVal;PropVariantClear(&value);properties->Release();}
        printf("{\"hwnd\":\"%p\",\"title\":%s,\"appId\":%s,\"visible\":%s,\"guarded\":%s,\"hit\":%lld,\"rect\":[%ld,%ld,%ld,%ld],\"style\":%lld}",hwnd,Json(title).c_str(),Json(appId).c_str(),IsWindowVisible(hwnd)?"true":"false",(GetPropW(hwnd,L"XueBuTong.BrowserWindowGuard.v2")||GetPropW(hwnd,L"XueBuTong.BrowserWindowGuard.v3")||GetPropW(hwnd,L"XueBuTong.BrowserWindowGuard.v4"))?"true":"false",static_cast<long long>(hit),bounds.left,bounds.top,bounds.right,bounds.bottom,static_cast<long long>(GetWindowLongPtrW(hwnd,GWL_STYLE)));
        if(!wcscmp(argv[3],L"close"))PostMessageW(hwnd,WM_CLOSE,0,0);
        if(!wcscmp(argv[3],L"system-close"))PostMessageW(hwnd,WM_SYSCOMMAND,SC_CLOSE,0);
        if(!wcscmp(argv[3],L"show"))ShowWindowAsync(hwnd,SW_SHOWNOACTIVATE);
        if(!wcscmp(argv[3],L"client-close")||!wcscmp(argv[3],L"client-body-click")){
            POINT point=close;
            if(!wcscmp(argv[3],L"client-body-click")){point.x=bounds.left+100;point.y=bounds.top+200;}
            if(ScreenToClient(hwnd,&point))PostMessageW(hwnd,WM_LBUTTONUP,0,MAKELPARAM(point.x,point.y));
        }
        if(!wcscmp(argv[3],L"click-close")){
            POINT previous{};GetCursorPos(&previous);const bool wasTopmost=(GetWindowLongPtrW(hwnd,GWL_EXSTYLE)&WS_EX_TOPMOST)!=0;
            SetWindowPos(hwnd,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_SHOWWINDOW);SetForegroundWindow(hwnd);Sleep(150);
            if(GetAncestor(WindowFromPoint(close),GA_ROOT)!=hwnd){if(!wasTopmost)SetWindowPos(hwnd,HWND_NOTOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);return 7;}
            SetCursorPos(close.x,close.y);INPUT inputs[2]{};inputs[0].type=INPUT_MOUSE;inputs[0].mi.dwFlags=MOUSEEVENTF_LEFTDOWN;inputs[1].type=INPUT_MOUSE;inputs[1].mi.dwFlags=MOUSEEVENTF_LEFTUP;
            if(SendInput(2,inputs,sizeof(INPUT))!=2)return 8;
            Sleep(200);SetCursorPos(previous.x,previous.y);if(IsWindow(hwnd)&&!wasTopmost)SetWindowPos(hwnd,HWND_NOTOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
        }
    }
    printf("]}\n");CoUninitialize();CloseHandle(process);return 0;
}
