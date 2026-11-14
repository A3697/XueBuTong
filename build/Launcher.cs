using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("学不通")]
[assembly: AssemblyProduct("学不通")]
[assembly: AssemblyVersion("2.5.10.0")]
[assembly: AssemblyFileVersion("2.5.10.0")]
internal static class Launcher
{
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr handle);
    [DllImport("user32.dll")] private static extern bool ShowWindowAsync(IntPtr handle, int command);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern IntPtr OpenProcess(uint access, bool inherit, int processId);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref int length);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    private static string ImagePath(int processId)
    {
        IntPtr handle=OpenProcess(0x1000,false,processId);
        if(handle==IntPtr.Zero)return null;
        try { int size=32768;StringBuilder name=new StringBuilder(size);return QueryFullProcessImageName(handle,0,name,ref size)?name.ToString():null; }
        finally { CloseHandle(handle); }
    }
    private static bool FocusExisting(string root)
    {
        string expected=Path.Combine(root,"ocs-lab","XueBuTong.exe");
        foreach(Process process in Process.GetProcessesByName("XueBuTong"))
        using(process)
        {
            try
            {
                if(!String.Equals(ImagePath(process.Id),expected,StringComparison.OrdinalIgnoreCase))continue;
                IntPtr window=process.MainWindowHandle;
                if(window==IntPtr.Zero)continue;
                ShowWindowAsync(window,IsIconic(window)?9:5);SetForegroundWindow(window);return true;
            }
            catch(InvalidOperationException){}
            catch(System.ComponentModel.Win32Exception){}
            catch(NotSupportedException){}
        }
        return false;
    }
    private static void LogError(string root,Exception error)
    {
        try { string folder=Path.Combine(root,"evidence");Directory.CreateDirectory(folder);File.AppendAllText(Path.Combine(folder,"launcher-errors.log"),DateTimeOffset.Now.ToString("o")+" "+error.ToString()+Environment.NewLine); }
        catch { }
    }
    [STAThread] private static int Main(string[] args)
    {
        Application.EnableVisualStyles();string root=Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location),identity;
        using(SHA256 hash=SHA256.Create())identity=BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(root.ToUpperInvariant()))).Replace("-","").Substring(0,24);
        using(Mutex mutex=new Mutex(false,"Local\\XueBuTongLauncher_"+identity))
        {
            bool acquired=false;
            try
            {
                try { acquired=mutex.WaitOne(0); }catch(AbandonedMutexException){acquired=true;}
                if(!acquired){FocusExisting(root);return 0;}
                if(FocusExisting(root))return 0;
                string python=Path.Combine(root,"python3144","pythonw.exe"),script=Path.Combine(root,"tools","launch_fusion.py");
                if(!File.Exists(python)||!File.Exists(script))throw new FileNotFoundException("启动文件不完整，请将 EXE 保留在完整软件目录中。");
                string arguments="-I -S -B \""+script+"\"";
                foreach(string argument in args)if(argument=="--software-rendering"||argument=="--debug")arguments+=" "+argument;
                ProcessStartInfo start=new ProcessStartInfo(python,arguments);
                start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;start.WindowStyle=ProcessWindowStyle.Hidden;
                using(Process child=Process.Start(start)) { child.WaitForExit();if(child.ExitCode!=0)return child.ExitCode; }
                for(int attempt=0;attempt<100;attempt++){if(FocusExisting(root))break;Thread.Sleep(100);}
                return 0;
            }
            catch(Exception error)
            {
                LogError(root,error);
                MessageBox.Show(error is FileNotFoundException?error.Message:"软件未能启动，请查看软件目录 evidence 中的 launcher-errors.log。","学不通",MessageBoxButtons.OK,MessageBoxIcon.Error);
                return 1;
            }
            finally {if(acquired)mutex.ReleaseMutex();}
        }
    }
}
