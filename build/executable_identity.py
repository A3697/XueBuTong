"""Check the names Windows permission dialogs and software lists actually read."""
import ctypes
from ctypes import wintypes


def read_identity(file):
    api = ctypes.WinDLL('version', use_last_error=True)
    api.GetFileVersionInfoSizeW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(wintypes.DWORD)]
    api.GetFileVersionInfoSizeW.restype = wintypes.DWORD
    api.GetFileVersionInfoW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID]
    api.GetFileVersionInfoW.restype = wintypes.BOOL
    api.VerQueryValueW.argtypes = [wintypes.LPCVOID, wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_void_p), ctypes.POINTER(wintypes.UINT)]
    api.VerQueryValueW.restype = wintypes.BOOL
    unused = wintypes.DWORD()
    size = api.GetFileVersionInfoSizeW(str(file), ctypes.byref(unused))
    if not size:
        raise ValueError('可执行文件缺少版本资源：' + str(file))
    data = ctypes.create_string_buffer(size)
    if not api.GetFileVersionInfoW(str(file), 0, size, data):
        raise ctypes.WinError(ctypes.get_last_error())
    address, length = ctypes.c_void_p(), wintypes.UINT()
    if not api.VerQueryValueW(data, r'\VarFileInfo\Translation', ctypes.byref(address), ctypes.byref(length)) or length.value < 4:
        raise ValueError('可执行文件缺少产品名称资源：' + str(file))
    words = ctypes.cast(address, ctypes.POINTER(wintypes.WORD))
    prefix = f'\\StringFileInfo\\{words[0]:04x}{words[1]:04x}\\'
    values = {}
    for field in ('FileDescription', 'ProductName', 'FileVersion', 'ProductVersion', 'OriginalFilename'):
        if not api.VerQueryValueW(data, prefix + field, ctypes.byref(address), ctypes.byref(length)):
            raise ValueError('可执行文件缺少 ' + field + '：' + str(file))
        values[field] = ctypes.wstring_at(address, length.value).rstrip('\x00')
    return values


def verify_identity(file, version):
    values = read_identity(file)
    expected = {'FileDescription': '学不通', 'ProductName': '学不通',
                'FileVersion': version + '.0', 'ProductVersion': version + '.0',
                'OriginalFilename': file.name}
    if values != expected:
        raise ValueError('可执行文件的名称或版本未同步：' + str(file) + '；' + repr(values))
    return values
