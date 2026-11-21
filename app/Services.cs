using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace TunerApp;

static class Paths
{
    /// <summary>Set only by self-tests (--data=PATH) so they never touch the real settings, history or downloaded updates.</summary>
    public static string? DataOverride { get; set; }
    public static string Data => DataOverride ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "iRacingGraphicsTuner");
    // Captures are meant to be opened and shared, so they live somewhere visible: Documents\Dialed\Captures.
    // (Explorer cannot open new folders under AppData\Roaming on some PCs, and a hidden folder is hard to find anyway.)
    public static string Captures => Path.Combine(DialedDocs, "Captures");

    static string? dialedDocs;
    /// <summary>Documents\Dialed, where captures, reports, share images and exports go so the user can find them. Some PCs have no usable Documents folder
    /// (redirected to a drive that is offline, a locked-down profile, no write access); then everything goes to a "documents" folder inside Dialed's own data
    /// folder instead, and the log says so. Decided once per run.</summary>
    public static string DialedDocs
    {
        get
        {
            if (dialedDocs != null) return dialedDocs;
            var docs = TestDocuments ?? Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (!string.IsNullOrWhiteSpace(docs))
            {
                try
                {
                    var p = Path.Combine(docs, "Dialed"); Directory.CreateDirectory(p);
                    var probe = Path.Combine(p, ".write-test-" + Guid.NewGuid().ToString("N")); File.WriteAllText(probe, "x"); File.Delete(probe);
                    return dialedDocs = p;
                }
                catch (Exception ex) { Log_("Documents folder not usable (" + ex.GetType().Name + "), using Dialed's own folder instead"); }
            }
            else Log_("no Documents folder reported by Windows, using Dialed's own folder instead");
            var fb = Path.Combine(Data, "documents"); Directory.CreateDirectory(fb);
            return dialedDocs = fb;
        }
    }
    /// <summary>Self-tests only: pretend Windows reported this as the Documents folder.</summary>
    public static string? TestDocuments { get; set; }
    /// <summary>For tests: forget the decision.</summary>
    public static void ForgetDialedDocs() => dialedDocs = null;
    static string OldCaptures => Path.Combine(Data, "captures");

    /// <summary>Earlier builds kept captures under AppData. Move them (never copy or delete) into Documents\Dialed\Captures.</summary>
    public static void MigrateOldCaptures()
    {
        try
        {
            if (!Directory.Exists(OldCaptures)) return;
            var files = Directory.GetFiles(OldCaptures);
            if (files.Length == 0) return;
            Directory.CreateDirectory(Captures);
            int moved = 0;
            foreach (var f in files)
            {
                var dest = Path.Combine(Captures, Path.GetFileName(f));
                if (!File.Exists(dest)) { File.Move(f, dest); moved++; }
            }
            Log_($"moved {moved} capture file(s) to {Captures}");
        }
        catch (Exception ex) { Log_("capture migration failed: " + ex.Message); }
    }
    // Backups live in one tidy subfolder inside the iRacing folder, so they are easy to find and never mixed in with iRacing's own files.
    public const string BackupsFolderName = "Dialed Backups";
    public const string OldBackupsFolderName = "iR Graphics Tuner Backups"; // the app's first name
    public static readonly string[] OldBackupsFolderNames = { OldBackupsFolderName, "Graphics Optimiser Backups" }; // earlier names; renamed automatically
    public static string Backups => Path.Combine(IRacingDocs, BackupsFolderName);
    public static string WebView => Path.Combine(Data, "webview");
    public static string Log => Path.Combine(Data, "app.log");
    /// <summary>Set only by the self-test (--docs=PATH) so tests never touch a real iRacing folder.</summary>
    public static string? DocsOverride { get; set; }
    /// <summary>Set only by the self-test (--lmu=PATH) so tests never touch a real Le Mans Ultimate folder.</summary>
    public static string? LmuOverride { get; set; }
    /// <summary>Self-test overrides for the other sims (--sim-ams2=PATH etc.): a throwaway folder standing in for the sim's data folder.</summary>
    public static Dictionary<string, string> SimOverrides { get; } = new();
    /// <summary>Tester switch (--enable-sims=ams2,acc): sims switched on for this run only, using their real settings folders.</summary>
    public static HashSet<string> EnabledSims { get; } = new(StringComparer.OrdinalIgnoreCase);
    public static string IRacingDocs => DocsOverride ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "iRacing");
    public static string PresentMon => Path.Combine(AppContext.BaseDirectory, "tools", "PresentMon.exe");

    public static void Ensure()
    {
        foreach (var d in new[] { Data, Captures, WebView }) Directory.CreateDirectory(d);
    }

    /// <summary>Earlier builds kept backups under %APPDATA%. Move them into the new folder so they are all in one place.</summary>
    public static void MigrateOldBackups()
    {
        try
        {
            var old = Path.Combine(Data, "backups");
            if (!Directory.Exists(old) || !Directory.Exists(IRacingDocs)) return;
            var files = Directory.GetFiles(old, "*.ini");
            if (files.Length == 0) return;
            Directory.CreateDirectory(Backups);
            foreach (var f in files)
            {
                var dest = Path.Combine(Backups, Path.GetFileName(f));
                if (!File.Exists(dest)) File.Move(f, dest);
            }
            Log_($"moved {files.Length} backup(s) to {Backups}");
        }
        catch (Exception ex) { Log_("backup migration failed: " + ex.Message); }
    }

    static readonly object LogLock = new();
    const long LogLimit = 300_000; // about 3,000 lines; one older file is kept as app.log.1, so the log never grows without bound
    public static void Log_(string line)
    {
        try
        {
            lock (LogLock)
            {
                Directory.CreateDirectory(Data);
                var fi = new FileInfo(Log);
                if (fi.Exists && fi.Length > LogLimit) File.Move(Log, Log + ".1", true);
                File.AppendAllText(Log, $"{DateTime.Now:s} {line}{Environment.NewLine}");
            }
        }
        catch { /* logging must never break the app */ }
    }
}

sealed class Hotkey
{
    public bool Ctrl { get; set; } = true;
    public bool Shift { get; set; } = true;
    public bool Alt { get; set; }
    public string Key { get; set; } = "F11";

    public string Text => string.Join("+", new[] { Ctrl ? "Ctrl" : null, Alt ? "Alt" : null, Shift ? "Shift" : null, Key }.Where(s => s != null));
}

sealed class Settings
{
    public Hotkey Hotkey { get; set; } = new();
    /// <summary>Also listen for the capture hotkey in a way that works inside games that block normal hotkeys. Watches that one combination only.</summary>
    public bool WideHotkey { get; set; } = true;
    public int CaptureSeconds { get; set; } = 60;
    public int Countdown { get; set; } = 10;
    public string? LastIni { get; set; }
    public string? LastSim { get; set; }
    /// <summary>Look for page updates when the app opens (and every few hours). Contacts only the project's GitHub releases.</summary>
    public bool AutoUpdateCheck { get; set; } = true;
    /// <summary>Spoken capture cues (the recorded voice) instead of plain beeps. Only matters when the voice clips are present.</summary>
    public bool CueVoice { get; set; } = true;
    /// <summary>Optional "owner/repo" override, for testing a fork.</summary>
    public string? UpdateRepo { get; set; }
    /// <summary>Keep Dialed running in the system tray when the window is closed or minimised, instead of exiting. Off by default: closing means closing.</summary>
    public bool TrayMode { get; set; }
    /// <summary>Tuck the window into the tray when a capture starts, so it is not on top of the game.</summary>
    public bool HideOnCapture { get; set; }
    /// <summary>A small Windows notification when a capture finishes, fails or is cancelled while the window is hidden.</summary>
    public bool NotifyOnCapture { get; set; } = true;
    /// <summary>Where the window was last time (restored only if it still lands on a connected screen).</summary>
    public int WinX { get; set; } = int.MinValue;
    public int WinY { get; set; } = int.MinValue;
    public int WinW { get; set; }
    public int WinH { get; set; }
    public bool WinMax { get; set; }

    static string FilePath => Path.Combine(Paths.Data, "settings.json");

    public static Settings Load()
    {
        try { if (File.Exists(FilePath)) return JsonSerializer.Deserialize<Settings>(File.ReadAllText(FilePath)) ?? new(); }
        catch (Exception ex) { Paths.Log_("settings load failed: " + ex.Message); }
        return new();
    }

    public void Save()
    {
        try { File.WriteAllText(FilePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true })); }
        catch (Exception ex) { Paths.Log_("settings save failed: " + ex.Message); }
    }
}

/// <summary>
/// Starts a program as the normal desktop user, even though this app runs elevated. An elevated Explorer cannot show
/// the user's own folders, and a browser started elevated is a risk, so both are launched with the desktop shell's own token.
/// </summary>
static class Unelevated
{
    [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool DuplicateTokenEx(IntPtr token, uint access, IntPtr attrs, int impersonationLevel, int tokenType, out IntPtr newToken);
    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessWithTokenW(IntPtr token, uint logonFlags, string? application, string commandLine, uint creationFlags, IntPtr env, string? directory, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
        public int cb; public string? lpReserved, lpDesktop, lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }
    [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

    public static bool IsElevated()
    {
        using var id = System.Security.Principal.WindowsIdentity.GetCurrent();
        return new System.Security.Principal.WindowsPrincipal(id).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
    }

    /// <summary>Opens a folder or an https link in the user's normal desktop session. Returns false if it could not.</summary>
    public static bool OpenTarget(string target)
    {
        var explorer = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe");
        var cmd = $"\"{explorer}\" \"{target}\"";
        try
        {
            if (!IsElevated()) { Process.Start(new ProcessStartInfo(explorer) { UseShellExecute = false, ArgumentList = { target } }); return true; }
            GetWindowThreadProcessId(GetShellWindow(), out var pid);
            if (pid == 0) return false;
            var proc = OpenProcess(0x0400 /*PROCESS_QUERY_INFORMATION*/, false, pid);
            if (proc == IntPtr.Zero) return false;
            IntPtr tok = IntPtr.Zero, dup = IntPtr.Zero;
            try
            {
                if (!OpenProcessToken(proc, 0x0002 /*TOKEN_DUPLICATE*/, out tok)) return false;
                if (!DuplicateTokenEx(tok, 0xF01FF /*TOKEN_ALL_ACCESS*/, IntPtr.Zero, 2 /*SecurityImpersonation*/, 1 /*TokenPrimary*/, out dup)) return false;
                var si = new STARTUPINFO { cb = Marshal.SizeOf<STARTUPINFO>() };
                if (!CreateProcessWithTokenW(dup, 0, null, cmd, 0, IntPtr.Zero, null, ref si, out var pi))
                { Paths.Log_("unelevated launch failed, error " + Marshal.GetLastWin32Error()); return false; }
                CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
                return true;
            }
            finally { if (tok != IntPtr.Zero) CloseHandle(tok); if (dup != IntPtr.Zero) CloseHandle(dup); CloseHandle(proc); }
        }
        catch (Exception ex) { Paths.Log_("unelevated launch failed: " + ex.Message); return false; }
    }
}

static class Backup
{
    /// <summary>A backup file name stamped with the time, moved on a second at a time if that name is already taken.</summary>
    public static string NewPath(string dir, string baseName, string ext, string tag = "")
    {
        string P(DateTime t) => Path.Combine(dir, $"{baseName} {t:yyyy-MM-dd HH-mm-ss}{tag}{ext}");
        var now = DateTime.Now;
        while (File.Exists(P(now))) now = now.AddSeconds(1);
        return P(now);
    }
}

// ---------------------------------------------------------------------------------------------------------------------
// The sims this app knows. To add one: add a SimDef here and a profile in the page (sims.js).
// ---------------------------------------------------------------------------------------------------------------------
/// <summary>Optional: the file may not exist yet (it is created when a change is saved, after an empty backup so a restore puts it back to "nothing").
/// InstallRel: a read-only file inside the game's own folder (never written), used for defaults the user file overrides.</summary>
sealed record SimFile(string Id, string Name, string Rel, bool Optional = false, string? InstallRel = null);
/// <summary>Process may list several names separated by "|". DocsRel: the sim keeps its settings under Documents\DocsRel instead of its Steam folder.
/// Reason: when set, the sim is a "Coming soon" tile (listed, but never read or written).</summary>
sealed record SimDef(string Id, string Name, string Process, string? SteamAppId, string? SteamFolder, string? BackupsRel, SimFile[] Files,
    string? DocsRel = null, string? Reason = null, string? LocalRel = null, string? SavedRel = null, string? Companion = null) // LocalRel: settings live under %LOCALAPPDATA%\LocalRel; SavedRel: under the user's Saved Games\SavedRel
    // Companion: programs ("|" separated) that keep their own copy of the sim's settings and write it back over any change made while they are open (Content Manager for Assetto Corsa)
{
    public string[] CompanionNames => Companion == null ? Array.Empty<string>() : Companion.Split('|', StringSplitOptions.RemoveEmptyEntries);
    // First release ships iRacing and Le Mans Ultimate; the rest wait as "Coming soon" (the self-tests point sims at fixture folders, so they stay switched on there).
    // --enable-sims=ams2 is a tester switch: it unlocks the named sims on this PC only (never set by the installer or shortcuts).
    public bool ComingSoon => Reason != null || (Id != "iracing" && Id != "lmu" && Id != "ams2" && Id != "ac" && Paths.SimOverrides.Count == 0 && !Paths.EnabledSims.Contains(Id));
    public string[] ProcessNames => Process.Split('|', StringSplitOptions.RemoveEmptyEntries);
}

static class SimService
{
    // iRacing has many renderer files to choose from, so IniService handles it; the others list their files here.
    public static readonly SimDef IRacing = new("iracing", "iRacing", "iRacingSim64DX11", null, null, null, Array.Empty<SimFile>());
    public static readonly SimDef Lmu = new("lmu", "Le Mans Ultimate", "Le Mans Ultimate", "2399420", "Le Mans Ultimate",
        @"UserData\" + Paths.BackupsFolderName, new[]
        {
            new SimFile("video", "Config_DX11.ini", @"UserData\Config_DX11.ini"),
            new SimFile("graphics", "Settings.JSON", @"UserData\player\Settings.JSON"),
        });
    // Automobilista 2: one XML file in Documents. AMS2.exe is the normal build, AMS2AVX.exe the older-CPU build.
    public static readonly SimDef Ams2 = new("ams2", "Automobilista 2", "AMS2|AMS2AVX", "1066890", "Automobilista 2",
        Paths.BackupsFolderName, new[] { new SimFile("main", "graphicsconfigdx11.xml", "graphicsconfigdx11.xml") }, DocsRel: "Automobilista 2");
    // Assetto Corsa (the original): Documents\Assetto Corsa\cfg\video.ini, a plain INI. acs.exe is the 64-bit game, acs_x86.exe the 32-bit one.
    // Content Manager starts the same acs.exe and writes the same file. Backups sit in Documents\Assetto Corsa\Dialed Backups.
    // Custom Shaders Patch (CSP) keeps its defaults in the game folder (extension\config) and only the values a player has changed in
    // Documents\Assetto Corsa\cfg\extension. Each CSP page Dialed adjusts is a pair: the user file (optional, may not exist) and the read-only defaults.
    static readonly string[] CspPages = { "graphics_adjustments", "lighting_fx", "extra_fx", "smart_shadows", "particles_fx", "reflections_fx", "rain_fx", "grass_fx", "skidmarks_fx", "smart_mirror", "general" };
    static SimFile[] AcFiles()
    {
        var l = new List<SimFile> { new("main", "video.ini", @"cfg\video.ini") };
        foreach (var n in CspPages)
        {
            l.Add(new("csp_" + n, n + ".ini", @"cfg\extension\" + n + ".ini", Optional: true));
            l.Add(new("cspdef_" + n, n + ".ini (CSP defaults)", "", Optional: true, InstallRel: @"extension\config\" + n + ".ini"));
        }
        return l.ToArray();
    }
    // Content Manager keeps its own copy of AC's settings in memory and writes it back to video.ini when the game closes (and on its own saves),
    // which silently undoes any change made while it is open, so it is a companion: closed with the game, and no change is written while it is open.
    public static readonly SimDef Ac = new("ac", "Assetto Corsa", "acs|acs_x86", "244210", "assettocorsa",
        Paths.BackupsFolderName, AcFiles(), DocsRel: "Assetto Corsa", Companion: "Content Manager");
    // Sims that are listed but not switched on yet. The reason is shown on the tile.
    static SimDef Soon(string id, string name, string process, string appId, string folder, string reason) =>
        new(id, name, process, appId, folder, null, Array.Empty<SimFile>(), null, reason);
    // Assetto Corsa Competizione: Documents\Assetto Corsa Competizione\Config\menuSettings.json (the Custom graphics sliders live in its customGraphicOptions block).
    public static readonly SimDef Acc = new("acc", "Assetto Corsa Competizione", "AC2-Win64-Shipping", "805550", "Assetto Corsa Competizione",
        Paths.BackupsFolderName, new[] { new SimFile("main", "menuSettings.json", @"Config\menuSettings.json") }, DocsRel: "Assetto Corsa Competizione");
    // Assetto Corsa EVO: Saved Games\ACE\video.videosettings (binary; the page only touches the few fields it has checked). Backups sit in Saved Games\ACE\Dialed Backups.
    public static readonly SimDef AcEvo = new("acevo", "Assetto Corsa EVO", "AssettoCorsaEVO", "3058630", "Assetto Corsa EVO",
        Paths.BackupsFolderName, new[] { new SimFile("main", "video.videosettings", "video.videosettings") }, SavedRel: "ACE");
    // RaceRoom: Documents\My Games\SimBin\RaceRoom Racing Experience\UserData\graphics_options.xml. Backups sit beside UserData, not inside it.
    public static readonly SimDef RaceRoom = new("raceroom", "RaceRoom", "RRRE64|RRRE", "211500", "raceroom racing experience",
        Paths.BackupsFolderName, new[] { new SimFile("main", "graphics_options.xml", @"UserData\graphics_options.xml") }, DocsRel: @"My Games\SimBin\RaceRoom Racing Experience");
    // Project Motor Racing: Documents\My Games\ProjectMotorRacing\savegame1\settings.xml. ProjectMotorRacing.exe is the launcher, ProjectMotorRacingGame.exe the game.
    public static readonly SimDef Pmr = new("pmr", "Project Motor Racing", "ProjectMotorRacingGame|ProjectMotorRacing", "299970", "Project Motor Racing",
        Paths.BackupsFolderName, new[] { new SimFile("main", "settings.xml", @"savegame1\settings.xml") }, DocsRel: @"My Games\ProjectMotorRacing");
    // BeamNG.drive: %LOCALAPPDATA%\BeamNG\BeamNG.drive\current\settings\settings.json. Backups go in %LOCALAPPDATA%\BeamNG\Dialed Backups,
    // outside BeamNG's own user folder (BeamNG.drive\current), which the game scans for mods and content.
    public static readonly SimDef BeamNg = new("beamng", "BeamNG.drive", "BeamNG.drive.x64", "284160", "BeamNG.drive",
        Paths.BackupsFolderName, new[] { new SimFile("main", "settings.json", @"BeamNG.drive\current\settings\settings.json") }, LocalRel: "BeamNG");
    public static readonly SimDef[] All = { IRacing, Lmu, Ams2, Ac, Acc, AcEvo, RaceRoom, Pmr, BeamNg };
    public static SimDef? ById(string? id) => All.FirstOrDefault(s => s.Id == id);

    // Game files are not guaranteed UTF-8; Latin-1 round-trips every byte unchanged.
    static readonly Encoding Enc = Encoding.Latin1;

    // ---------- finding the sim ----------
    static string? SteamInstall()
    {
        var p = Registry.GetValue(@"HKEY_CURRENT_USER\Software\Valve\Steam", "SteamPath", null) as string;
        p = p?.Replace('/', '\\');
        if (p != null && Directory.Exists(p)) return p;
        var def = @"C:\Program Files (x86)\Steam";
        return Directory.Exists(def) ? def : null;
    }

    static List<string> SteamLibraries()
    {
        var libs = new List<string>();
        var steam = SteamInstall();
        if (steam == null) return libs;
        libs.Add(steam);
        try
        {
            var vdf = Path.Combine(steam, "steamapps", "libraryfolders.vdf");
            if (File.Exists(vdf))
                foreach (Match m in Regex.Matches(File.ReadAllText(vdf), "\"path\"\\s+\"([^\"]+)\""))
                    libs.Add(m.Groups[1].Value.Replace(@"\\", @"\"));
        }
        catch (Exception ex) { Paths.Log_("steam libraries failed: " + ex.Message); }
        return libs.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    public static string? Root(SimDef sim)
    {
        if (sim.Id == "iracing") return Directory.Exists(Paths.IRacingDocs) ? Paths.IRacingDocs : null;
        if (sim.ComingSoon) return null;
        if (sim.Id == "lmu" && Paths.LmuOverride != null) return Directory.Exists(Paths.LmuOverride) ? Paths.LmuOverride : null;
        if (Paths.SimOverrides.TryGetValue(sim.Id, out var ov)) return Directory.Exists(ov) ? ov : null;
        if (sim.SavedRel != null)
        {
            var sg = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Saved Games", sim.SavedRel);
            return Directory.Exists(sg) ? sg : null;
        }
        if (sim.LocalRel != null)
        {
            var l = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), sim.LocalRel);
            return Directory.Exists(l) ? l : null;
        }
        if (sim.DocsRel != null)
        {
            var d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), sim.DocsRel);
            return Directory.Exists(d) ? d : null;
        }
        return SteamGameDir(sim);
    }

    /// <summary>The game's own folder inside a Steam library (steamapps\common\...), or null.</summary>
    public static string? SteamGameDir(SimDef sim)
    {
        if (sim.SteamFolder == null) return null;
        foreach (var lib in SteamLibraries())
        {
            var p = Path.Combine(lib, "steamapps", "common", sim.SteamFolder);
            if (Directory.Exists(p)) return p;
        }
        return null;
    }

    /// <summary>Where read-only game-folder files live. The self-test points a sim at a throwaway folder whose "game" subfolder stands in for it.</summary>
    static string? InstallDir(SimDef sim)
    {
        if (Paths.SimOverrides.TryGetValue(sim.Id, out var ov)) { var g = Path.Combine(ov, "game"); return Directory.Exists(g) ? g : null; }
        return SteamGameDir(sim);
    }

    /// <summary>The app was renamed, so its backup folders are renamed too (same place, same files, new name). Nothing is copied or deleted.</summary>
    public static void MigrateBackupFolders()
    {
        foreach (var sim in All)
        {
            try
            {
                var root = Root(sim);
                if (root == null) continue;
                var parent = sim.Id == "iracing" ? root : Path.GetDirectoryName(Path.Combine(root, sim.BackupsRel ?? "x"))!;
                var next = Path.Combine(parent, Paths.BackupsFolderName);
                foreach (var oldName in Paths.OldBackupsFolderNames)
                {
                    var old = Path.Combine(parent, oldName);
                    if (Directory.Exists(old) && !Directory.Exists(next)) { Directory.Move(old, next); Paths.Log_($"renamed backup folder for {sim.Name}"); }
                }
            }
            catch (Exception ex) { Paths.Log_($"backup folder rename failed for {sim.Name}: {ex.Message}"); }
        }
    }

    public static string? FilePath(SimDef sim, SimFile f)
    {
        if (f.InstallRel != null) { var g = InstallDir(sim); return g == null ? null : Path.Combine(g, f.InstallRel); }
        var r = Root(sim); return r == null ? null : Path.Combine(r, f.Rel);
    }

    public static string? BackupsDir(SimDef sim)
    {
        if (sim.Id == "iracing") return Directory.Exists(Paths.IRacingDocs) ? Paths.Backups : null;
        var r = Root(sim);
        return r == null || sim.BackupsRel == null ? null : Path.Combine(r, sim.BackupsRel);
    }

    /// <summary>Is this file name one the tool is allowed to touch for this sim? (Never VR.)</summary>
    public static bool TargetValid(SimDef sim, string name) =>
        sim.Id == "iracing" ? IniService.IsValidName(name) : sim.Files.Any(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase));

    public static string? LivePath(SimDef sim, string fileName)
    {
        if (sim.Id == "iracing") return Path.Combine(Paths.IRacingDocs, fileName);
        var f = sim.Files.FirstOrDefault(x => x.Name.Equals(fileName, StringComparison.OrdinalIgnoreCase));
        return f == null ? null : FilePath(sim, f);
    }

    // ---------- running state ----------
    /// <summary>Set only by the self-test, which works on throwaway folders and so does not care whether the real sim is open.</summary>
    public static bool IgnoreRunning { get; set; }
    public static bool IsRunning(SimDef sim) => !IgnoreRunning && sim.ProcessNames.Any(n => Process.GetProcessesByName(n).Length > 0);
    public static Dictionary<string, bool> RunningMap() => All.ToDictionary(s => s.Id, IsRunning);
    /// <summary>The game or one of its companions is open, so changing its settings file would be undone: the game rewrites it on exit, a companion writes its own copy back.</summary>
    public static bool Holds(SimDef sim) => IsRunning(sim) || (!IgnoreRunning && sim.CompanionNames.Any(n => Process.GetProcessesByName(n).Length > 0));
    public static Dictionary<string, bool> HoldingMap() => All.ToDictionary(s => s.Id, Holds);
    static string CloseFirst(SimDef sim) => IsRunning(sim)
        ? $"Close {sim.Name} first. It rewrites its settings when it exits and would undo the change."
        : $"Close {string.Join(" and ", sim.CompanionNames)} first. It keeps its own copy of {sim.Name}'s settings and would write them back over the change.";

    /// <summary>Asks the sim to close like a normal exit and waits for it. It never force-kills the sim.</summary>
    public static Task<(bool ok, string message)> CloseAsync(SimDef sim, int timeoutMs = 30000) =>
        CloseProcessesAsync(sim.ProcessNames.Concat(sim.CompanionNames).ToArray(),
            sim.CompanionNames.Length == 0 ? sim.Name : sim.Name + " and " + string.Join(" and ", sim.CompanionNames), () => Holds(sim), timeoutMs);

    /// <summary>
    /// Asks the game to close the way a person would (closing its window), and gives it time to save. If its window has stopped
    /// responding (a hung game never reads the request), it is ended after a short wait instead of letting the user wait for nothing.
    /// A game that IS responding but has not closed (for example a "leave the session?" question) is left alone and reported.
    /// </summary>
    public static async Task<(bool ok, string message)> CloseProcessesAsync(string[] names, string display, Func<bool> stillRunning, int timeoutMs = 30000, int hungAfterMs = 8000)
    {
        var procs = names.SelectMany(n => Process.GetProcessesByName(n)).ToArray();
        if (procs.Length == 0) return (true, "");
        foreach (var p in procs) { try { p.CloseMainWindow(); } catch { /* already closing */ } }
        var sw = Stopwatch.StartNew();
        bool endedHung = false;
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            if (!stillRunning()) { await Task.Delay(endedHung ? 500 : 2000); return (true, ""); } // a game that closes by itself writes its settings files while exiting
            if (!endedHung && sw.ElapsedMilliseconds >= hungAfterMs)
            {
                foreach (var p in names.SelectMany(n => Process.GetProcessesByName(n)))
                {
                    bool hung = false;
                    try { hung = !p.Responding; } catch { /* gone already */ }
                    if (!hung) continue;
                    Paths.Log_($"close: {display} ({p.ProcessName}, pid {p.Id}) is not responding, ending it");
                    try { p.Kill(true); endedHung = true; } catch (Exception ex) { Paths.Log_("close: could not end it: " + ex.Message); }
                }
            }
            await Task.Delay(500);
        }
        // name only what is still open, and log what it was showing, so a program that ignores the request can be understood later
        var left = names.SelectMany(n => Process.GetProcessesByName(n)).ToArray();
        foreach (var p in left)
        {
            string title = "", responding = "?";
            try { title = p.MainWindowTitle; responding = p.Responding.ToString(); } catch { /* gone already */ }
            Paths.Log_($"close: {p.ProcessName} (pid {p.Id}) did not close within {timeoutMs / 1000} s; window \"{title}\", responding: {responding}");
        }
        var who = left.Length == 0 ? display : string.Join(" and ", left.Select(p => p.ProcessName).Distinct());
        return (false, $"{who} did not close within {timeoutMs / 1000} seconds, so nothing was changed. Close it yourself (in Task Manager if it will not respond), then apply again. It may be asking you a question, such as whether to leave a session or save something.");
    }

    // ---------- logos: read from the user's own Steam folder, never bundled ----------
    static readonly Dictionary<string, string?> LogoCache = new();
    public static string? Logo(SimDef sim)
    {
        if (sim.SteamAppId == null) return null;
        lock (LogoCache)
        {
            if (LogoCache.TryGetValue(sim.Id, out var cached)) return cached;
            string? result = null;
            try
            {
                var steam = SteamInstall();
                var dir = steam == null ? null : Path.Combine(steam, "appcache", "librarycache", sim.SteamAppId);
                if (dir != null && Directory.Exists(dir))
                {
                    var f = Directory.GetFiles(dir, "logo.png", SearchOption.AllDirectories).FirstOrDefault();
                    if (f != null && new FileInfo(f).Length < 400_000) result = "data:image/png;base64," + Convert.ToBase64String(File.ReadAllBytes(f));
                }
            }
            catch (Exception ex) { Paths.Log_("logo failed for " + sim.Id + ": " + ex.Message); }
            return LogoCache[sim.Id] = result;
        }
    }

    public static object[] Describe() => All.Select(s =>
    {
        var root = Root(s);
        var files = s.Files.Select(f => { var p = FilePath(s, f); return new { id = f.Id, name = f.Name, optional = f.Optional, exists = p != null && File.Exists(p) }; }).ToArray();
        return (object)new
        {
            id = s.Id, name = s.Name, running = IsRunning(s), logo = Logo(s), files,
            comingSoon = s.ComingSoon, reason = s.Reason, installed = s.Id == "iracing" ? root != null : SteamInstalled(s),
            found = !s.ComingSoon && (s.Id == "iracing" ? root != null : root != null && files.Where(x => !x.optional).All(x => x.exists)),
            csp = s.Files.Any(f => f.InstallRel != null) && files.Any(x => x.optional && x.exists && x.name.EndsWith("(CSP defaults)")),   // Custom Shaders Patch is installed (its default files are there)
        };
    }).ToArray();

    /// <summary>Is the game installed (its Steam folder exists)? Test overrides count as installed.</summary>
    public static bool SteamInstalled(SimDef s)
    {
        if (Paths.SimOverrides.ContainsKey(s.Id) || (s.Id == "lmu" && Paths.LmuOverride != null)) return true;
        if (s.SteamFolder == null) return false;
        return SteamLibraries().Any(lib => Directory.Exists(Path.Combine(lib, "steamapps", "common", s.SteamFolder)));
    }

    // ---------- reading and writing the sim's own files ----------
    public static object[] ReadAll(SimDef sim) => sim.Files.Select(f =>
    {
        var path = FilePath(sim, f);
        bool isDefault = f.InstallRel != null;
        return (object)(path != null && File.Exists(path)
            ? new { fileId = f.Id, name = f.Name, missing = false, optional = f.Optional, isDefault, text = File.ReadAllText(path, Enc) }
            : new { fileId = f.Id, name = f.Name, missing = true, optional = f.Optional, isDefault, text = "" });
    }).ToArray();

    /// <summary>Backs up one file, then replaces it. The sim rewrites its settings on exit, so it must be closed.</summary>
    public static (bool ok, string message, string? backup) Write(SimDef sim, SimFile f, string text)
    {
        try
        {
            if (f.InstallRel != null) return (false, $"{f.Name} belongs to the game and is never changed.", null);
            var path = FilePath(sim, f);
            var existed = path != null && File.Exists(path);
            if (path == null || (!existed && !f.Optional)) return (false, $"{f.Name} was not found in your {sim.Name} folder.", null);
            if (Holds(sim)) return (false, CloseFirst(sim), null);
            var dir = BackupsDir(sim)!; Directory.CreateDirectory(dir);
            var backup = Backup.NewPath(dir, Path.GetFileNameWithoutExtension(f.Name), Path.GetExtension(f.Name));
            // A file that does not exist yet gets an EMPTY backup, so restoring it puts the setting back to "nothing changed" (an empty override file means defaults).
            if (existed) File.Copy(path, backup, overwrite: false); else File.WriteAllBytes(backup, Array.Empty<byte>());
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var tmp = path + ".tuner-tmp";
            File.WriteAllText(tmp, text, Enc);
            File.Move(tmp, path, overwrite: true);
            return (true, "Saved.", backup);
        }
        catch (Exception ex) { Paths.Log_($"write {f.Name} failed: {ex.Message}"); return (false, ex.Message, null); }
    }

    /// <summary>Writes several files as one change: if any write fails, the ones already written are put back.</summary>
    public static (bool ok, string message, string? backup) WriteSet(SimDef sim, IReadOnlyList<(SimFile f, string text)> items)
    {
        var done = new List<(string path, string backup)>();
        string? firstBackup = null;
        foreach (var (f, text) in items)
        {
            var r = Write(sim, f, text);
            if (!r.ok)
            {
                foreach (var d in done) { try { File.Copy(d.backup, d.path, overwrite: true); } catch { /* best effort */ } }
                return (false, r.message + (done.Count > 0 ? " The earlier change was undone." : ""), null);
            }
            done.Add((FilePath(sim, f)!, r.backup!));
            firstBackup ??= r.backup;
        }
        return (true, "Saved.", firstBackup);
    }
}

static class IniService
{
    // iRacing's files are not guaranteed UTF-8; Latin-1 round-trips every byte unchanged.
    static readonly Encoding Enc = Encoding.Latin1;

    public static bool IsValidName(string name) =>
        name == Path.GetFileName(name) && name.StartsWith("renderer", StringComparison.OrdinalIgnoreCase) &&
        name.EndsWith(".ini", StringComparison.OrdinalIgnoreCase) &&
        // This tool is not for VR: the OpenVR and OpenXR files are never offered or touched.
        !name.Contains("OpenVR", StringComparison.OrdinalIgnoreCase) && !name.Contains("OpenXR", StringComparison.OrdinalIgnoreCase);

    public static object[] List()
    {
        if (!Directory.Exists(Paths.IRacingDocs)) return Array.Empty<object>();
        return new DirectoryInfo(Paths.IRacingDocs).GetFiles("renderer*.ini").Where(f => IsValidName(f.Name))
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .Select(f => (object)new { name = f.Name, modified = f.LastWriteTime.ToString("s") }).ToArray();
    }

    public static string Read(string name)
    {
        if (!IsValidName(name)) throw new ArgumentException("Not an iRacing graphics file.");
        return File.ReadAllText(Path.Combine(Paths.IRacingDocs, name), Enc);
    }

    public static bool IRacingRunning() => SimService.IsRunning(SimService.IRacing);

    /// <summary>Backs up the current file, then replaces it. iRacing rewrites its files on exit, so it must be closed.</summary>
    public static (bool ok, string message, string? backup) Write(string name, string text)
    {
        if (!IsValidName(name)) return (false, "Not an iRacing graphics file.", null);
        if (IRacingRunning()) return (false, "Close iRacing first. It rewrites its settings when it exits and would undo the change.", null);
        var path = Path.Combine(Paths.IRacingDocs, name);
        if (!File.Exists(path)) return (false, "The file is no longer in your iRacing folder.", null);

        Directory.CreateDirectory(Paths.Backups);
        var backup = Backup.NewPath(Paths.Backups, Path.GetFileNameWithoutExtension(name), ".ini");
        File.Copy(path, backup, overwrite: false);
        var tmp = path + ".tuner-tmp";
        File.WriteAllText(tmp, text, Enc);
        File.Move(tmp, path, overwrite: true);
        return (true, "Saved.", backup);
    }
}

/// <summary>Lists and restores this app's backups for every sim, and tidies loose backup files out of the iRacing folder.</summary>
static class BackupService
{
    // "rendererDX11Monitor 2026-11-17 17-28-48.ini", "Settings 2026-11-17 17-28-48.JSON" (optionally "... before restore"),
    // or the older iRacing-only "rendererDX11Monitor.20261117-172848.ini"
    static readonly Regex Current = new(@"^(?<base>.+?) (?<ts>\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})(?<tag> before restore)?(?<ext>\.ini|\.json|\.xml|\.videosettings)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    static readonly Regex Legacy = new(@"^(?<base>.+)\.(?<ts>\d{8}-\d{6})\.ini$", RegexOptions.Compiled);
    // Loose manual backups such as "rendererDX11Monitor.ini.bak-2026-10-15" or "rendererDX11Monitor.ini.backup-2026..."
    static readonly Regex Loose = new(@"^renderer[^\\/]*\.ini\.(bak|backup)([-_.][^\\/]*)?$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    public const string MovedFolder = "Moved from iRacing folder";

    public static bool TryParse(SimDef sim, string fileName, out string target, out DateTime at)
    {
        target = ""; at = default;
        var m = Current.Match(fileName);
        if (m.Success && DateTime.TryParseExact(m.Groups["ts"].Value, "yyyy-MM-dd HH-mm-ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out at))
        { target = m.Groups["base"].Value + m.Groups["ext"].Value; return SimService.TargetValid(sim, target); }
        if (sim.Id == "iracing")
        {
            m = Legacy.Match(fileName);
            if (m.Success && DateTime.TryParseExact(m.Groups["ts"].Value, "yyyyMMdd-HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out at))
            { target = m.Groups["base"].Value + ".ini"; return IniService.IsValidName(target); }
        }
        return false;
    }

    public static object[] List()
    {
        var items = new List<(DateTime at, object item)>();
        foreach (var sim in SimService.All)
        {
            var dir = SimService.BackupsDir(sim);
            if (dir == null || !Directory.Exists(dir)) continue;
            foreach (var f in new DirectoryInfo(dir).GetFiles().Where(x => x.Extension.Equals(".ini", StringComparison.OrdinalIgnoreCase) || x.Extension.Equals(".json", StringComparison.OrdinalIgnoreCase) || x.Extension.Equals(".xml", StringComparison.OrdinalIgnoreCase) || x.Extension.Equals(".videosettings", StringComparison.OrdinalIgnoreCase)))
                if (TryParse(sim, f.Name, out var target, out var at))
                    items.Add((at, new { sim = sim.Id, file = f.Name, target, at = at.ToString("s"), kb = (int)Math.Ceiling(f.Length / 1024.0) }));
        }
        return items.OrderByDescending(x => x.at).Select(x => x.item).ToArray();
    }

    /// <summary>Puts a backup back as the live file. The current file is backed up first, so a restore can be undone too.</summary>
    public static (bool ok, string message) Restore(string simId, string file)
    {
        var sim = SimService.ById(simId);
        if (sim == null) return (false, "Unknown sim.");
        var dir = SimService.BackupsDir(sim);
        if (dir == null || file != Path.GetFileName(file) || !TryParse(sim, file, out var target, out _)) return (false, "That is not one of this app's backups.");
        var src = Path.Combine(dir, file);
        if (!File.Exists(src)) return (false, "That backup is no longer in the folder.");
        if (SimService.Holds(sim)) return (false, SimService.IsRunning(sim) ? $"Close {sim.Name} first. It rewrites its settings when it exits and would undo the restore."
            : $"Close {string.Join(" and ", sim.CompanionNames)} first. It keeps its own copy of {sim.Name}'s settings and would write them back over the restore.");
        var dest = SimService.LivePath(sim, target);
        if (dest == null) return (false, "Could not find the file this backup belongs to.");
        if (File.Exists(dest))
            File.Copy(dest, Backup.NewPath(dir, Path.GetFileNameWithoutExtension(target), Path.GetExtension(target), " before restore"), overwrite: false);
        var tmp = dest + ".tuner-tmp";
        File.Copy(src, tmp, overwrite: true);
        File.Move(tmp, dest, overwrite: true);
        return (true, "Restored.");
    }

    static bool IsLooseBackup(string name) =>
        name == Path.GetFileName(name) && Loose.IsMatch(name) &&
        !name.Contains("OpenVR", StringComparison.OrdinalIgnoreCase) && !name.Contains("OpenXR", StringComparison.OrdinalIgnoreCase); // VR files are not this tool's business

    public static object[] ScanLoose()
    {
        if (!Directory.Exists(Paths.IRacingDocs)) return Array.Empty<object>();
        return new DirectoryInfo(Paths.IRacingDocs).GetFiles().Where(f => IsLooseBackup(f.Name))
            .OrderByDescending(f => f.LastWriteTime)
            .Select(f => (object)new { file = f.Name, kb = (int)Math.Ceiling(f.Length / 1024.0), modified = f.LastWriteTime.ToString("s") }).ToArray();
    }

    /// <summary>Moves (never deletes or renames) the named loose backups into a subfolder of the backups folder.</summary>
    public static (int moved, int failed) MoveLoose(IEnumerable<string> files)
    {
        int moved = 0, failed = 0;
        var destDir = Path.Combine(Paths.Backups, MovedFolder);
        foreach (var name in files.Distinct())
        {
            try
            {
                var src = Path.Combine(Paths.IRacingDocs, name);
                if (!IsLooseBackup(name) || !File.Exists(src)) { failed++; continue; }
                Directory.CreateDirectory(destDir);
                var dest = Path.Combine(destDir, name);
                for (int n = 2; File.Exists(dest); n++) dest = Path.Combine(destDir, $"{name} ({n})");
                File.Move(src, dest);
                moved++;
            }
            catch (Exception ex) { Paths.Log_("tidy move failed for " + name + ": " + ex.Message); failed++; }
        }
        return (moved, failed);
    }
}

static class Vram
{
    /// <summary>Total dedicated video memory of the largest adapter, in bytes (0 if unknown).</summary>
    public static long TotalBytes()
    {
        long best = 0;
        try
        {
            using var cls = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}");
            if (cls == null) return 0;
            foreach (var sub in cls.GetSubKeyNames())
            {
                try // some entries (for example "Configuration") deny access; skip them, keep going
                {
                    using var k = cls.OpenSubKey(sub);
                    var v = k?.GetValue("HardwareInformation.qwMemorySize");
                    long n = v switch { long l => l, int i => i, byte[] b when b.Length >= 8 => BitConverter.ToInt64(b, 0), _ => 0 };
                    if (n > best) best = n;
                }
                catch (System.Security.SecurityException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
        catch (Exception ex) { Paths.Log_("vram total failed: " + ex.Message); }
        return best;
    }

    /// <summary>Samples dedicated video memory used by one process, via Windows performance counters.</summary>
    public sealed class Sampler : IDisposable
    {
        // One probe per graphics adapter the process touches: its "dedicated" figure, its "local" (resident) figure, and what the whole adapter is really using.
        sealed record Probe(PerformanceCounter Dedicated, PerformanceCounter? Local, PerformanceCounter? Adapter);
        readonly List<Probe> probes = new();
        bool warned;
        public double MaxBytes { get; private set; }

        static PerformanceCounter? Make(string category, string counter, string instance)
        {
            try { return new PerformanceCounter(category, counter, instance, true); } catch { return null; }
        }

        public Sampler(int pid)
        {
            try
            {
                var cat = new PerformanceCounterCategory("GPU Process Memory");
                foreach (var inst in cat.GetInstanceNames().Where(n => n.StartsWith($"pid_{pid}_", StringComparison.Ordinal)))
                {
                    var ded = Make("GPU Process Memory", "Dedicated Usage", inst);
                    if (ded == null) continue;
                    var luid = inst.Substring(inst.IndexOf("_luid_", StringComparison.Ordinal) + 1); // "luid_0x..._phys_0", the same name the adapter counters use
                    probes.Add(new Probe(ded, Make("GPU Process Memory", "Local Usage", inst), Make("GPU Adapter Memory", "Dedicated Usage", luid)));
                }
            }
            catch (Exception ex) { Paths.Log_("vram sampler failed: " + ex.Message); }
        }

        /// <summary>
        /// The per-process "dedicated" figure is normally right, but some games (RaceRoom, for one) make Windows report what they have
        /// RESERVED, which can be several times the whole card (43 GB on an 8 GB card). A process cannot really use more dedicated memory
        /// than the adapter is in total using, so when it claims to, the resident "local" figure is used instead.
        /// </summary>
        public static double Plausible(double dedicated, double? local, double? adapter, long totalVram)
        {
            bool impossible = adapter.HasValue ? dedicated > adapter.Value * 1.1 + 256 * 1048576.0
                                               : totalVram > 0 && dedicated > totalVram * 1.25;
            return impossible && local.HasValue ? local.Value : dedicated;
        }

        public void Sample()
        {
            try
            {
                double sum = 0; long total = TotalBytes();
                foreach (var p in probes)
                {
                    double ded = p.Dedicated.NextValue(); double? loc = p.Local?.NextValue(), ad = p.Adapter?.NextValue();
                    var v = Plausible(ded, loc, ad, total);
                    if (v != ded && !warned) { warned = true; Paths.Log_($"vram: process reported {ded / 1048576:N0} MB dedicated (adapter in use {(ad ?? 0) / 1048576:N0} MB); using the resident figure {v / 1048576:N0} MB"); }
                    sum += v;
                }
                if (sum > MaxBytes) MaxBytes = sum;
            }
            catch (Exception ex) { Paths.Log_("vram sample failed: " + ex.Message); }
        }

        public void Dispose() { foreach (var p in probes) { p.Dedicated.Dispose(); p.Local?.Dispose(); p.Adapter?.Dispose(); } }
    }
}

/// <summary>Known background programs that compete with the sim and skew captures.</summary>
static class Busy
{
    static readonly (string proc, string label)[] Known =
    {
        ("obs64", "OBS"), ("Streamlabs OBS", "Streamlabs"), ("chrome", "Chrome"), ("msedge", "Edge"), ("firefox", "Firefox"),
        ("brave", "Brave"), ("opera", "Opera"), ("discord", "Discord"), ("spotify", "Spotify"), ("ms-teams", "Teams"),
        ("Teams", "Teams"), ("OneDrive", "OneDrive"), ("Dropbox", "Dropbox"), ("GoogleDriveFS", "Google Drive"),
        ("wallpaper64", "Wallpaper Engine"), ("wallpaper32", "Wallpaper Engine"), ("iCUE", "iCUE"), ("SignalRgb", "SignalRGB"),
    };

    public static string[] Running()
    {
        try
        {
            var running = Process.GetProcesses().Select(p => p.ProcessName).ToHashSet(StringComparer.OrdinalIgnoreCase);
            return Known.Where(k => running.Contains(k.proc)).Select(k => k.label).Distinct().ToArray();
        }
        catch (Exception ex) { Paths.Log_("busy check failed: " + ex.Message); return Array.Empty<string>(); }
    }
}

sealed record CaptureResult(string Name, string Path, string Text, double VramUsedBytes, long VramTotalBytes, string[] Busy);

/// <summary>
/// Spoken cues for a capture, from short WAV files in assets\sounds (announce, 3, 2, 1, start, done, cancel, error). Any clip that is missing
/// or is not a playable WAV falls back to the plain beep, so the app always makes a sound. The folder comes from the active page, so a
/// page update can ship new recordings without a new program.
/// </summary>
static class SoundPack
{
    public static readonly string[] Names = { "announce", "3", "2", "1", "start", "done", "cancel", "error" };
    static readonly Dictionary<string, System.Media.SoundPlayer?> cache = new();
    public static string? FolderOverride { get; set; }
    public static string Folder => FolderOverride ?? Path.Combine(UpdateService.ActiveWeb(), "assets", "sounds");

    /// <summary>False when the player chose plain beeps: every cue then reports "no clip" and the caller beeps instead.</summary>
    public static bool UseVoice { get; set; } = true;
    public static string? Find(string name) { if (!UseVoice) return null; var p = Path.Combine(Folder, name + ".wav"); return File.Exists(p) ? p : null; }
    public static bool Has(string name) => Find(name) != null;
    /// <summary>Are the recorded clips there at all? (The page only offers the voice/beeps choice when they are.)</summary>
    public static bool ClipsExist() => Names.Any(n => File.Exists(Path.Combine(Folder, n + ".wav")));

    /// <summary>Plays the clip and returns true, or returns false (and the caller beeps) when there is no usable clip.</summary>
    public static bool Play(string name)
    {
        lock (cache)
        {
            if (!cache.TryGetValue(name, out var sp))
            {
                sp = null;
                var path = Find(name);
                if (path != null)
                {
                    try { var s = new System.Media.SoundPlayer(path); s.Load(); sp = s; }
                    catch (Exception ex) { Paths.Log_($"sound '{name}': not a playable WAV ({ex.Message})"); }
                }
                cache[name] = sp;
            }
            if (sp == null) return false;
            try { sp.Play(); return true; }
            catch (Exception ex) { Paths.Log_($"sound '{name}' could not play: {ex.Message}"); return false; }
        }
    }

    public static void ForgetAll() { lock (cache) cache.Clear(); }
}

static class CaptureService
{
    static void Beep(int freq, int ms) => Task.Run(() => { try { Console.Beep(freq, ms); } catch { /* no sound device */ } });
    /// <summary>Several beeps one after another (a single background task, so they never overlap).</summary>
    public static void BeepSeq(params (int freq, int ms)[] notes) => Task.Run(() => { foreach (var n in notes) { try { Console.Beep(n.freq, n.ms); } catch { /* no sound device */ } } });

    public static async Task<CaptureResult> RunAsync(SimDef sim, int seconds, int countdown, Action<object> report, CancellationToken ct)
    {
        if (!File.Exists(Paths.PresentMon)) throw new FileNotFoundException("The capture engine is missing from the app folder (tools\\PresentMon.exe). Reinstall the app.");
        var simProc = sim.ProcessNames.SelectMany(n => Process.GetProcessesByName(n)).FirstOrDefault()
            ?? throw new InvalidOperationException($"{sim.Name} is not running. Start the sim and get on track first.");

        var busy = Busy.Running();
        for (int i = countdown; i > 0; i--)
        {
            report(new { type = "capture", phase = "countdown", secondsLeft = i, busy });
            if (i == countdown && countdown >= 6) SoundPack.Play("announce"); // "Capture about to start" (only when there is time to say it before "3")
            if (i <= 3 && !SoundPack.Play(i.ToString())) Beep(660, 120);
            await Task.Delay(1000, ct);
        }
        if (simProc.HasExited) throw new InvalidOperationException($"{sim.Name} closed before the capture started.");

        Directory.CreateDirectory(Paths.Captures);
        var name = $"capture-{sim.Id}-{DateTime.Now:yyyyMMdd-HHmmss}.csv";
        var path = Path.Combine(Paths.Captures, name);
        var psi = new ProcessStartInfo(Paths.PresentMon)
        {
            UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true,
        };
        // ArgumentList quotes each value, so process names with spaces ("Le Mans Ultimate.exe") are passed whole.
        foreach (var a in new[] { "--process_name", simProc.ProcessName + ".exe", "--timed", seconds.ToString(), "--terminate_after_timed",
                                  "--no_console_stats", "--v2_metrics", "--session_name", "iRacingTuner", "--stop_existing_session",
                                  "--output_file", path })
            psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("Could not start the capture engine.");
        var err = new StringBuilder();
        proc.ErrorDataReceived += (_, e) => { if (e.Data != null) err.AppendLine(e.Data); };
        proc.OutputDataReceived += (_, e) => { if (e.Data != null) err.AppendLine(e.Data); };
        proc.BeginErrorReadLine(); proc.BeginOutputReadLine();
        if (!SoundPack.Play("start")) Beep(988, 400);

        using var vram = new Vram.Sampler(simProc.Id);
        var sw = Stopwatch.StartNew();
        try
        {
            var exit = proc.WaitForExitAsync(ct);
            while (!exit.IsCompleted)
            {
                vram.Sample();
                report(new { type = "capture", phase = "recording", secondsLeft = Math.Max(0, seconds - (int)sw.Elapsed.TotalSeconds), total = seconds });
                await Task.WhenAny(exit, Task.Delay(1000, ct));
            }
            await exit;
        }
        catch (OperationCanceledException)
        {
            try { if (!proc.HasExited) proc.Kill(true); } catch { }
            try { File.Delete(path); } catch { }
            throw;
        }
        if (!SoundPack.Play("done")) { Beep(988, 150); await Task.Delay(250, CancellationToken.None); Beep(988, 150); }

        if (proc.ExitCode != 0 || !File.Exists(path) || new FileInfo(path).Length < 200)
        {
            Paths.Log_($"capture failed exit={proc.ExitCode}: {err}");
            throw new InvalidOperationException($"The capture did not record anything. Make sure {sim.Name} is on track and showing frames, then try again.");
        }
        return new CaptureResult(name, path, await File.ReadAllTextAsync(path, CancellationToken.None), vram.MaxBytes, Vram.TotalBytes(), Busy.Running());
    }
}
