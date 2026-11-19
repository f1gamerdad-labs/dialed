using System.Diagnostics;

namespace TunerApp;

/// <summary>Saves a share image the page drew (a PNG, sent as base64) into Documents\Dialed\Share cards. Only a real PNG with a safe file name is ever written.</summary>
static class ShareCards
{
    public static string Save(string rawName, string base64, string? dirOverride = null)
    {
        var safe = System.Text.RegularExpressions.Regex.Replace(Path.GetFileNameWithoutExtension(rawName ?? "Dialed.png"), @"[^A-Za-z0-9 _\-]", "-");
        if (safe.Length == 0) safe = "Dialed";
        if ((base64 ?? "").Length > 12_000_000) throw new InvalidOperationException("the image is too large");
        var bytes = Convert.FromBase64String(base64 ?? "");
        if (bytes.Length < 8 || bytes[0] != 0x89 || bytes[1] != (byte)'P' || bytes[2] != (byte)'N' || bytes[3] != (byte)'G') throw new InvalidOperationException("that is not a PNG image");
        var dir = dirOverride ?? Path.Combine(Paths.DialedDocs, "Share cards");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, safe + ".png"); int n = 2;
        while (File.Exists(file)) file = Path.Combine(dir, $"{safe} ({n++}).png");
        File.WriteAllBytes(file, bytes);
        return file;
    }
}

/// <summary>Saves the settings and history file the page builds (Export), into Documents\Dialed\Exports. Only valid JSON of a sane size, with a safe file name.</summary>
static class SettingsExports
{
    public static string Save(string rawName, string json, string? dirOverride = null)
    {
        var safe = System.Text.RegularExpressions.Regex.Replace(Path.GetFileNameWithoutExtension(rawName ?? "Dialed-settings"), @"[^A-Za-z0-9 _\-]", "-");
        if (safe.Length == 0) safe = "Dialed-settings";
        if ((json ?? "").Length < 2 || json!.Length > 4_000_000) throw new InvalidOperationException("the export is empty or too large");
        using (System.Text.Json.JsonDocument.Parse(json)) { }   // throws if it is not JSON
        var dir = dirOverride ?? Path.Combine(Paths.DialedDocs, "Exports");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, safe + ".json"); int n = 2;
        while (File.Exists(file)) file = Path.Combine(dir, $"{safe} ({n++}).json");
        File.WriteAllText(file, json, new System.Text.UTF8Encoding(false));
        return file;
    }
}

/// <summary>Adds Dialed to the Start menu and the desktop, so people who unzipped it into a folder can open it like any other program.
/// Uses Windows' own shortcut object (WScript.Shell), so no extra library is needed. Nothing is installed and nothing outside the two shortcuts is touched.</summary>
static class Shortcuts
{
    /// <summary>desktopDir / startDir are only for the self-test, which writes into a throwaway folder instead of the real desktop.</summary>
    public static (bool desktop, bool startMenu, string? error) Create(string? desktopDir = null, string? startDir = null)
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
            var desk = Make(desktopDir ?? Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory));
            var start = Make(startDir ?? Environment.GetFolderPath(Environment.SpecialFolder.Programs));
            Paths.Log_($"shortcuts: desktop {desk}, start menu {start}");
            return (desk, start, desk || start ? null : "Windows would not let the shortcuts be created");
        }
        catch (Exception ex) { Paths.Log_("shortcuts failed: " + ex.Message); return (false, false, ex.Message); }
    }
}
