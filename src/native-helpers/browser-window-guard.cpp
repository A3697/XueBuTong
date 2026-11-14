#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>
#include <cwchar>
#include <string>
#include <set>
#include <vector>
#include <shellapi.h>
#include <shobjidl.h>
#include <propkey.h>
#include <propvarutil.h>

static DWORD g_process=0;
static const wchar_t* kProperty=L"XueBuTong.BrowserWindowGuard.v4";
static UINT g_attach=RegisterWindowMessageW(L"XueBuTong.AttachBrowserGuard.v4");
static UINT g_release=RegisterWindowMessageW(L"XueBuTong.ReleaseBrowserGuard.v4");
static std::wstring g_name;
static void ApplyIdentity(HWND window){
    COPYDATASTRUCT copy{0x58544249,static_cast<DWORD>((g_name.size()+1)*sizeof(wchar_t)),const_cast<wchar_t*>(g_name.c_str())};
    DWORD_PTR ignored=0;SendMessageTimeoutW(window,WM_COPYDATA,0,reinterpret_cast<LPARAM>(&copy),SMTO_ABORTIFHUNG,1000,&ignored);
}
static bool IsGrouped(HWND window){
    IPropertyStore* store=nullptr;if(FAILED(SHGetPropertyStoreForWindow(window,IID_PPV_ARGS(&store))))return false;
    PROPVARIANT value{};bool grouped=SUCCEEDED(store->GetValue(PKEY_AppUserModel_ID,&value))&&value.vt==VT_LPWSTR&&value.pwszVal&&wcscmp(value.pwszVal,L"XueBuTong.Desktop")==0;
    PropVariantClear(&value);store->Release();return grouped;
}
static std::vector<HWND> Frames(){
    std::vector<HWND> windows;
    EnumWindows([](HWND window,LPARAM value)->BOOL{
        DWORD process=0;GetWindowThreadProcessId(window,&process);
        wchar_t name[96]={};
        if(process==g_process&&GetClassNameW(window,name,96)&&wcscmp(name,L"Chrome_WidgetWin_1")==0&&(GetWindowLongPtrW(window,GWL_STYLE)&WS_CAPTION)==WS_CAPTION)
            reinterpret_cast<std::vector<HWND>*>(value)->push_back(window);
        return TRUE;
    },reinterpret_cast<LPARAM>(&windows));
    return windows;
}
int wmain(int count,wchar_t** values){
    if(count!=3)return 2;
    wchar_t* end=nullptr;unsigned long process=wcstoul(values[1],&end,10);
    if(!process||!end||*end)return 2;g_process=static_cast<DWORD>(process);
    HANDLE target=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,g_process);
    if(!target)return 3;
    wchar_t image[32768]={};DWORD length=32768;
    if(!QueryFullProcessImageNameW(target,0,image,&length)||_wcsicmp(image,values[2])!=0){CloseHandle(target);return 4;}
    CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    wchar_t own[32768]={};GetModuleFileNameW(nullptr,own,32768);
    std::wstring folder=own;folder=folder.substr(0,folder.find_last_of(L"\\/")+1);
    HMODULE library=LoadLibraryW((folder+L"browser-window-hook.dll").c_str());
    if(!library){CloseHandle(target);CoUninitialize();return 5;}
    const auto callback=reinterpret_cast<HOOKPROC>(GetProcAddress(library,"GuardHook"));
    if(!callback){FreeLibrary(library);CloseHandle(target);CoUninitialize();return 5;}
    std::vector<HHOOK> hooks;std::set<DWORD> threads;
    auto attach=[&](){
        for(HWND window:Frames()){
            DWORD actual=0;DWORD thread=GetWindowThreadProcessId(window,&actual);
            if(actual!=g_process)continue;
            if(!threads.count(thread)){
                HHOOK hook=SetWindowsHookExW(WH_CALLWNDPROC,callback,library,thread);
                if(hook){hooks.push_back(hook);threads.insert(thread);}
            }
            DWORD_PTR ignored=0;SendMessageTimeoutW(window,g_attach,0,0,SMTO_ABORTIFHUNG,1000,&ignored);
            if(GetPropW(window,kProperty))ApplyIdentity(window);
        }
    };
    auto release=[&](){
        for(HWND window:Frames()){
            DWORD_PTR ignored=0;
            if(!SendMessageTimeoutW(window,g_release,0,0,SMTO_ABORTIFHUNG,1500,&ignored))PostMessageW(window,g_release,0,0);
        }
        for(HHOOK hook:hooks)UnhookWindowsHookEx(hook);
        FreeLibrary(library);CloseHandle(target);CoUninitialize();
    };
    attach();const auto frames=Frames();size_t guarded=0,grouped=0;for(HWND window:frames)if(GetPropW(window,kProperty)){guarded++;if(IsGrouped(window))grouped++;}
    if(!guarded||guarded!=frames.size()||grouped!=guarded){release();return 6;}
    printf("{\"ready\":true,\"version\":4,\"windows\":%zu,\"groupedWindows\":%zu}\n",guarded,grouped);fflush(stdout);
    char line[2048]={};
    while(fgets(line,sizeof(line),stdin)){
        if(WaitForSingleObject(target,0)==WAIT_OBJECT_0)break;
        if(strncmp(line,"stop",4)==0)break;
        if(strncmp(line,"refresh",7)==0)attach();
        if(strncmp(line,"name\t",5)==0){
            size_t bytes=strcspn(line+5,"\r\n");int length=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,line+5,static_cast<int>(bytes),nullptr,0);
            if((!bytes||length>0)&&length<=120){g_name.assign(length,L'\0');if(length)MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,line+5,static_cast<int>(bytes),g_name.data(),length);attach();}
        }
        if(strncmp(line,"show\t",5)==0){
            const unsigned long request=strtoul(line+5,nullptr,10);bool shown=true;attach();
            for(HWND window:Frames()){
                DWORD_PTR result=0;
                if(!SendMessageTimeoutW(window,RegisterWindowMessageW(L"XueBuTong.ShowBrowserGuard.v4"),0,0,SMTO_ABORTIFHUNG,2000,&result)||!result)shown=false;
            }
            printf("{\"showRequest\":%lu,\"shown\":%s}\n",request,shown?"true":"false");fflush(stdout);
        }
        if(strncmp(line,"hide",4)==0)for(HWND window:Frames())ShowWindowAsync(window,SW_HIDE);
    }
    release();
    printf("{\"released\":true}\n");fflush(stdout);
    return 0;
}
