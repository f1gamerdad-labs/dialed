using System.Diagnostics;

namespace TunerApp;

/// <summary>Adds Dialed to the Start menu and the desktop, so people who unzipped it into a folder can open it like any other program.
/// Uses Windows' own shortcut object (WScript.Shell), so no extra library is needed. Nothing is installed and nothing outside the two shortcuts is touched.</summary>
static class Shortcuts
{
    public static (bool desktop, bool startMenu, string? error) Create()
    {
        try
        {
            var exe = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(exe) || !File.Exists(exe)) return (false, false, "could not find the program file");
            var type = Type.GetTypeFromProgID("WScript.Shell");
            if (type == null) return (false, false, "Windows shortcut support is not available");
            dynamic shell = Activator.CreateInstance(type)!;
            bool Make(string folder)
            {
                try
                {
                    if (string.IsNullOrEmpty(folder)) return false;
                    Directory.CreateDirectory(folder);
                    dynamic lnk = shell.CreateShortcut(Path.Combine(folder, "Dialed.lnk"));
                    lnk.TargetPath = exe; lnk.WorkingDirectory = Path.GetDirectoryName(exe); lnk.Description = "Dialed: Sim Graphics Optimiser by F1GamerDad";
                    lnk.IconLocation = exe + ",0"; lnk.Save();
                    return true;
                }
                catch (Exception ex) { Paths.Log_("shortcut: " + folder + ": " + ex.Message); return false; }
            }
            var desk = Make(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            var start = Make(Environment.GetFolderPath(Environment.SpecialFolder.Programs));
            Paths.Log_($"shortcuts: desktop {desk}, start menu {start}");
            return (desk, start, desk || start ? null : "Windows would not let the shortcuts be created");
        }
        catch (Exception ex) { Paths.Log_("shortcuts failed: " + ex.Message); return (false, false, ex.Message); }
    }
}
