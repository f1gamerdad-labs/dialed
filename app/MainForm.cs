using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TunerApp;

public sealed class MainForm : Form
{
    const int WM_HOTKEY = 0x0312, HOTKEY_ID = 1;
    const uint MOD_ALT = 1, MOD_CONTROL = 2, MOD_SHIFT = 4, MOD_NOREPEAT = 0x4000;

    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint vk);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    readonly WebView2 web = new() { Dock = DockStyle.Fill };
    readonly Settings settings;
    readonly bool selfTest;
    CancellationTokenSource? capture;
    string hotkeyStatus = "";
    SimDef currentSim = SimService.IRacing; // the sim picked at the top of the page; the hotkey captures this one
    UpdateInfo? pendingUpdate;
    readonly System.Windows.Forms.Timer updateTimer = new() { Interval = 6 * 60 * 60 * 1000 };

    public MainForm(string[] args)
    {
        string? Arg(string name) => args.FirstOrDefault(a => a.StartsWith(name + "=", StringComparison.Ordinal))?.Substring(name.Length + 1).Trim('"');
        Paths.DocsOverride = Arg("--docs");
        Paths.LmuOverride = Arg("--lmu");
        foreach (var s in SimService.All) if (Arg("--sim-" + s.Id) is { } so) Paths.SimOverrides[s.Id] = so;
        Paths.DataOverride = Arg("--data");
        Paths.Ensure();
        settings = Settings.Load();
        Paths.Log_($"start: Dialed host {UpdateService.HostVersion}, page {UpdateService.CurrentVersion()}, Windows {Environment.OSVersion.Version}");
        if (!string.IsNullOrWhiteSpace(settings.UpdateRepo)) UpdateService.RepoSlug = settings.UpdateRepo!;
        if (args.Contains("--selftest-update") && Paths.DataOverride != null && Arg("--update-test-url") is { } testUrl)
        {
            Load += async (_, _) => { await RunUpdateSelfTestAsync(testUrl); Close(); };
            return;
        }
        if (args.Contains("--selftest-report") && Paths.DataOverride != null) // builds a report zip from throwaway data and lists what is in it (nothing is posted)
        {
            Load += (_, _) =>
            {
                SimService.IgnoreRunning = true;
                for (int i = 0; i < 6; i++) Paths.Log_("selftest line " + i); // make sure the log exists
                var zip = ReportService.Build("self test message", "me@example.test", true, true, "{\"sim\":\"lmu\"}", SimService.Lmu, null);
                using var z = System.IO.Compression.ZipFile.OpenRead(zip);
                var names = z.Entries.Select(e => e.FullName).ToList();
                string Txt(string n) { using var s = new StreamReader(z.GetEntry(n)!.Open()); return s.ReadToEnd(); }
                File.WriteAllText(Path.Combine(Paths.Data, "selftest-report.json"), JsonSerializer.Serialize(new
                {
                    zip, names, system = Txt("system.txt"),
                    json = names.Contains("settings/Settings.JSON") ? Txt("settings/Settings.JSON") : "",
                }));
                Close();
            };
            return;
        }
        currentSim = SimService.ById(settings.LastSim) ?? SimService.IRacing;
        selfTest = args.Contains("--selftest");
        if (args.Contains("--selftest-open")) // opens the captures folder the way the button does, then reports
        {
            Load += async (_, _) =>
            {
                Directory.CreateDirectory(Paths.Captures);
                var ok = Unelevated.OpenTarget(Paths.Captures);
                await Task.Delay(500);
                File.WriteAllText(Path.Combine(Paths.Data, "selftest-open.json"), JsonSerializer.Serialize(new { launched = ok }));
                await Task.Delay(4000); // leave the window up long enough to be seen
                Close();
            };
            return;
        }
        if (args.Contains("--selftest-backups") && Paths.DocsOverride != null)
        {
            SimService.IgnoreRunning = true; // throwaway folders only; see SimService.IgnoreRunning
            Load += (_, _) => { RunBackupSelfTest(); Close(); };
            return;
        }
        SimService.MigrateBackupFolders();
        Paths.MigrateOldBackups();
        Paths.MigrateOldCaptures();
        Text = "Dialed by F1GamerDad";
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { /* default icon */ }
        ClientSize = new Size(1280, 900);
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(web);
        Load += async (_, _) => await InitAsync();
    }

    async Task InitAsync()
    {
        try
        {
            // The welcome video should start by itself, with sound, because the user has just opened the app on purpose.
            var env = await CoreWebView2Environment.CreateAsync(null, Paths.WebView,
                new CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = "--autoplay-policy=no-user-gesture-required" });
            await web.EnsureCoreWebView2Async(env);
            var core = web.CoreWebView2;
            core.SetVirtualHostNameToFolderMapping("tuner.local", UpdateService.ActiveWeb(), // the downloaded page if there is a newer one, else the bundled one
                CoreWebView2HostResourceAccessKind.Allow);
            core.WebMessageReceived += (_, e) => OnMessage(e.WebMessageAsJson);
            // Links never open inside the app. Web links go to the user's normal browser; everything else is ignored.
            core.NewWindowRequested += (_, e) => { e.Handled = true; OpenExternal(e.Uri); };
            core.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var u) || u.Host == "tuner.local") return;
                e.Cancel = true; OpenExternal(e.Uri);
            };
            core.NavigationCompleted += async (_, _) => { if (selfTest) await RunSelfTest(); };
            // Look for a page update shortly after the app opens, then every few hours, if the user has not switched it off.
            updateTimer.Tick += async (_, _) => { if (settings.AutoUpdateCheck) await CheckUpdateAsync(silent: true); };
            updateTimer.Start();
            _ = Task.Run(async () => { await Task.Delay(8000); if (settings.AutoUpdateCheck) await CheckUpdateAsync(silent: true); });
            hotkeyStatus = TryRegisterHotkey(settings.Hotkey);
            core.Navigate("https://tuner.local/index.html");
        }
        catch (Exception ex)
        {
            Paths.Log_("init failed: " + ex);
            MessageBox.Show("The app could not start its web view.\n\n" + ex.Message +
                "\n\nInstall the Microsoft Edge WebView2 Runtime and try again.", Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
        }
    }

    // ---------- hotkey ----------
    string TryRegisterHotkey(Hotkey h)
    {
        UnregisterHotKey(Handle, HOTKEY_ID);
        if (!Enum.TryParse<Keys>(h.Key, true, out var key)) return "That key is not supported.";
        uint mods = MOD_NOREPEAT | (h.Ctrl ? MOD_CONTROL : 0) | (h.Shift ? MOD_SHIFT : 0) | (h.Alt ? MOD_ALT : 0);
        return RegisterHotKey(Handle, HOTKEY_ID, mods, (uint)key) ? "" : "Another program is already using " + h.Text + ". Pick a different combination.";
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID) { _ = ToggleCaptureAsync(); return; }
        base.WndProc(ref m);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        UnregisterHotKey(Handle, HOTKEY_ID);
        capture?.Cancel();
        base.OnFormClosed(e);
    }

    // ---------- capture ----------
    async Task ToggleCaptureAsync()
    {
        if (capture != null) { capture.Cancel(); return; }
        capture = new CancellationTokenSource();
        var sim = currentSim;
        Paths.Log_($"capture start: {sim.Name}, {settings.CaptureSeconds}s");
        try
        {
            var r = await CaptureService.RunAsync(sim, settings.CaptureSeconds, settings.Countdown, Post, capture.Token);
            Post(new { type = "capture", phase = "done", sim = sim.Id, name = r.Name, text = r.Text, vramUsedBytes = r.VramUsedBytes, vramTotalBytes = r.VramTotalBytes, busy = r.Busy });
        }
        catch (OperationCanceledException) { Post(new { type = "capture", phase = "cancelled" }); }
        catch (Exception ex)
        {
            Paths.Log_("capture error: " + ex.Message);
            Post(new { type = "capture", phase = "error", message = ex.Message });
        }
        finally { capture.Dispose(); capture = null; }
    }

    // ---------- page bridge ----------
    void Post(object payload)
    {
        var json = JsonSerializer.Serialize(payload);
        void send() { if (web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsJson(json); }
        if (InvokeRequired) BeginInvoke(send); else send();
    }

    // ---------- page updates ----------
    async Task CheckUpdateAsync(bool silent)
    {
        if (!UpdateService.Configured) { if (!silent) Post(new { type = "update", state = "error", message = "Updates are not switched on for this copy yet." }); return; }
        try
        {
            var info = await UpdateService.CheckAsync();
            pendingUpdate = info;
            if (info == null) Post(new { type = "update", state = "none", silent, version = UpdateService.CurrentVersion() });
            else Post(new { type = "update", state = "available", silent, version = info.Version, notes = info.Notes, size = info.Size });
        }
        catch (Exception ex)
        {
            Paths.Log_("update check failed: " + ex.Message);
            if (!silent) Post(new { type = "update", state = "error", message = "Could not check for updates. Check your internet connection and try again." });
        }
    }

    async Task ApplyUpdateAsync()
    {
        if (pendingUpdate == null) return;
        if (capture != null) { Post(new { type = "update", state = "error", message = "Finish or cancel the capture first, then update." }); return; }
        Post(new { type = "update", state = "downloading", version = pendingUpdate.Version });
        try
        {
            await UpdateService.ApplyAsync(pendingUpdate);
            pendingUpdate = null;
            await ReloadPageAsync();
        }
        catch (Exception ex)
        {
            Paths.Log_("update failed: " + ex.Message);
            Post(new { type = "update", state = "error", message = ex.Message });
        }
    }

    async Task ReloadPageAsync()
    {
        var core = web.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping("tuner.local", UpdateService.ActiveWeb(), CoreWebView2HostResourceAccessKind.Allow);
        try { await core.Profile.ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache); } catch { /* the page still reloads */ } // cache only: history lives in local storage and is kept
        core.Reload();
    }

    /// <summary>Writes the changed files of one sim (closing the sim first if asked), with backups and rollback.</summary>
    async Task WriteFilesAsync(int id, string simId, List<(string fileId, string name, string text)> files, bool closeSim)
    {
        void Fail(string why) => Post(new { type = "iniWritten", id, ok = false, message = why, backup = (string?)null });
        try
        {
            var sim = SimService.ById(simId);
            if (sim == null) { Fail("Unknown sim."); return; }
            if (closeSim && SimService.IsRunning(sim))
            {
                capture?.Cancel(); // never leave a capture running against a closing sim
                Post(new { type = "iniProgress", text = $"Closing {sim.Name}..." });
                var (closed, why) = await SimService.CloseAsync(sim);
                if (!closed) { Fail(why); return; }
                Post(new { type = "iniProgress", text = $"{sim.Name} closed. Saving your changes..." });
            }
            (bool ok, string message, string? backup) r;
            if (sim.Id == "iracing")
            {
                if (files.Count != 1) { Fail("iRacing has one settings file to change."); return; }
                r = IniService.Write(files[0].name, files[0].text);
            }
            else
            {
                var items = new List<(SimFile, string)>();
                foreach (var f in files)
                {
                    var def = sim.Files.FirstOrDefault(x => x.Id == f.fileId);
                    if (def == null) { Fail($"{f.name} is not one of the files this tool changes for {sim.Name}."); return; }
                    items.Add((def, f.text));
                }
                r = SimService.WriteSet(sim, items);
            }
            Paths.Log_($"write {sim.Name}: ok={r.ok} {r.message}");
            Post(new { type = "iniWritten", id, ok = r.ok, message = r.message, backup = r.backup });
        }
        catch (Exception ex)
        {
            Paths.Log_("write files failed: " + ex);
            Fail(ex.Message);
        }
    }

    /// <summary>Opens an https link in the default browser, in the user's normal session, so the browser does not inherit this app's admin rights.</summary>
    static void OpenExternal(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u) || u.Scheme != Uri.UriSchemeHttps) return;
        if (!Unelevated.OpenTarget(u.AbsoluteUri)) Paths.Log_("open url failed: " + u.Host);
    }

    async Task RestoreAsync(string simId, string file, bool closeSim)
    {
        try
        {
            var sim = SimService.ById(simId);
            if (sim == null) { Post(new { type = "restored", ok = false, message = "Unknown sim." }); return; }
            if (closeSim && SimService.IsRunning(sim))
            {
                capture?.Cancel();
                Post(new { type = "backupProgress", text = $"Closing {sim.Name}..." });
                var (closed, why) = await SimService.CloseAsync(sim);
                if (!closed) { Post(new { type = "restored", ok = false, message = why }); return; }
            }
            var (ok, message) = BackupService.Restore(simId, file);
            Post(new { type = "restored", ok, message });
        }
        catch (Exception ex)
        {
            Paths.Log_("restore failed: " + ex);
            Post(new { type = "restored", ok = false, message = ex.Message });
        }
    }

    async Task ReportAsync(string message, string contact, bool withData, bool withSettings, string pageState, string summary)
    {
        try
        {
            var sim = currentSim; var ini = settings.LastIni;
            Paths.Log_($"report requested (data={withData}, settings={withSettings})");
            var zip = await Task.Run(() => ReportService.Build(message, contact, withData, withSettings, pageState, sim, ini));
            var header = ReportService.SystemText(sim, ini);
            var sent = await ReportService.PostAsync(message, contact, header + "\n" + summary);
            var dir = Path.GetDirectoryName(zip)!;
            var opened = Unelevated.OpenTarget(dir);
            Post(new { type = "reportDone", ok = true, sent, path = zip, folderOpened = opened });
        }
        catch (Exception ex)
        {
            Paths.Log_("report failed: " + ex);
            Post(new { type = "reportDone", ok = false, sent = false, path = "", error = ex.Message });
        }
    }

    void OnMessage(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var r = doc.RootElement;
            switch (r.GetProperty("type").GetString())
            {
                case "hello":
                    Post(new
                    {
                        type = "hello", appVersion = new { content = UpdateService.CurrentVersion(), host = UpdateService.HostVersion },
                        updates = new { configured = UpdateService.Configured, auto = settings.AutoUpdateCheck, canRevert = UpdateService.CanRevert },
                        hotkey = HotkeyInfo(), hotkeyError = hotkeyStatus, iniDir = Paths.IRacingDocs,
                        ini = IniService.List(), lastIni = settings.LastIni, seconds = settings.CaptureSeconds, countdown = settings.Countdown,
                        busy = Busy.Running(), sims = SimService.Describe(), running = SimService.RunningMap(), sim = currentSim.Id,
                    });
                    break;
                case "log": // errors from the page itself, so they end up in the same log
                {
                    var line = (r.GetProperty("line").GetString() ?? "").Replace('\r', ' ').Replace('\n', ' ');
                    Paths.Log_("page: " + (line.Length > 600 ? line.Substring(0, 600) : line));
                    break;
                }
                case "report":
                {
                    var msg = r.GetProperty("message").GetString() ?? "";
                    var contact = r.TryGetProperty("contact", out var cp) ? cp.GetString() ?? "" : "";
                    var withData = r.TryGetProperty("data", out var dp) && dp.GetBoolean();
                    var withSettings = r.TryGetProperty("settings", out var sp2) && sp2.GetBoolean();
                    var pageState = r.TryGetProperty("state", out var st) ? st.GetString() ?? "" : "";
                    var summary = r.TryGetProperty("summary", out var su) ? su.GetString() ?? "" : "";
                    _ = ReportAsync(msg, contact, withData, withSettings, pageState, summary);
                    break;
                }
                case "checkUpdate": _ = CheckUpdateAsync(silent: false); break;
                case "applyUpdate": _ = ApplyUpdateAsync(); break;
                case "revertUpdate":
                    if (capture != null) { Post(new { type = "update", state = "error", message = "Finish or cancel the capture first." }); break; }
                    if (UpdateService.Revert()) _ = ReloadPageAsync(); else Post(new { type = "update", state = "error", message = "There is no earlier version to go back to." });
                    break;
                case "setUpdateCheck":
                    settings.AutoUpdateCheck = r.GetProperty("enabled").GetBoolean(); settings.Save();
                    break;
                case "setSim":
                    currentSim = SimService.ById(r.GetProperty("sim").GetString()) ?? SimService.IRacing;
                    settings.LastSim = currentSim.Id; settings.Save();
                    break;
                case "readSim": // sims with fixed file locations (everything except iRacing, which has a file picker)
                {
                    var sim = SimService.ById(r.GetProperty("sim").GetString()) ?? SimService.IRacing;
                    Post(new { type = "simFiles", sim = sim.Id, files = SimService.ReadAll(sim) });
                    break;
                }
                case "openUrl":
                    OpenExternal(r.GetProperty("url").GetString() ?? "");
                    break;
                case "listBackups":
                    Post(new { type = "backups", items = BackupService.List() });
                    break;
                case "restoreBackup":
                    _ = RestoreAsync(r.GetProperty("sim").GetString() ?? "iracing", r.GetProperty("file").GetString() ?? "",
                        r.TryGetProperty("closeSim", out var rc) && rc.GetBoolean());
                    break;
                case "scanTidy":
                    Post(new { type = "tidy", items = BackupService.ScanLoose(), dir = Paths.Backups });
                    break;
                case "moveTidy":
                {
                    var files = r.GetProperty("files").EnumerateArray().Select(e => e.GetString() ?? "").ToList();
                    var (moved, failed) = BackupService.MoveLoose(files);
                    Post(new { type = "tidyDone", moved, failed, dest = Path.Combine(Paths.Backups, BackupService.MovedFolder) });
                    break;
                }
                case "busyCheck":
                    Post(new { type = "busy", busy = Busy.Running(), running = SimService.RunningMap() });
                    break;
                case "readIni": // iRacing: the user picks which renderer file
                {
                    var name = r.GetProperty("name").GetString() ?? "";
                    settings.LastIni = name; settings.Save();
                    Post(new { type = "ini", name, text = IniService.Read(name) });
                    break;
                }
                case "writeFiles":
                {
                    var files = r.GetProperty("files").EnumerateArray()
                        .Select(e => (e.GetProperty("fileId").GetString() ?? "", e.GetProperty("name").GetString() ?? "", e.GetProperty("text").GetString() ?? "")).ToList();
                    _ = WriteFilesAsync(r.GetProperty("id").GetInt32(), r.GetProperty("sim").GetString() ?? "iracing", files,
                        r.TryGetProperty("closeSim", out var cs) && cs.GetBoolean());
                    break;
                }
                case "startCapture": _ = ToggleCaptureAsync(); break;
                case "setHotkey":
                {
                    var h = new Hotkey
                    {
                        Ctrl = r.GetProperty("ctrl").GetBoolean(), Shift = r.GetProperty("shift").GetBoolean(),
                        Alt = r.GetProperty("alt").GetBoolean(), Key = r.GetProperty("key").GetString() ?? "F11",
                    };
                    var err = TryRegisterHotkey(h);
                    if (err == "") { settings.Hotkey = h; settings.Save(); }
                    else TryRegisterHotkey(settings.Hotkey); // put the old one back
                    Post(new { type = "hotkey", ok = err == "", error = err, hotkey = HotkeyInfo() });
                    break;
                }
                case "openFolder":
                {
                    var sim = SimService.ById(r.TryGetProperty("sim", out var sp) ? sp.GetString() : null) ?? currentSim;
                    string? folder = r.GetProperty("which").GetString() == "backups" ? SimService.BackupsDir(sim) : Paths.Captures;
                    if (folder == null) { Post(new { type = "folderOpened", ok = false, path = "" }); break; }
                    var parent = Path.GetDirectoryName(folder);
                    if (folder == Paths.Captures || (parent != null && Directory.Exists(parent))) Directory.CreateDirectory(folder);
                    var opened = Directory.Exists(folder) && Unelevated.OpenTarget(folder);
                    Post(new { type = "folderOpened", ok = opened, path = folder }); // if it could not open, the page shows the path
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            Paths.Log_("message failed: " + ex);
            Post(new { type = "error", message = ex.Message });
        }
    }

    object HotkeyInfo() => new { ctrl = settings.Hotkey.Ctrl, shift = settings.Hotkey.Shift, alt = settings.Hotkey.Alt, key = settings.Hotkey.Key, text = settings.Hotkey.Text };

    // ---------- backup self test: `iRGraphicsTuner.exe --selftest-backups --docs=<throwaway> --lmu=<throwaway>` ----------
    // Exercises backup, restore, list, rollback and tidy against folders prepared by the tester. Never run it on a real sim folder.
    void RunBackupSelfTest()
    {
        var checks = new List<object>();
        void Check(string name, bool pass, string detail = "") => checks.Add(new { name, pass, detail });
        try
        {
            var docs = Paths.IRacingDocs; var live = Path.Combine(docs, "rendererDX11Monitor.ini");
            if (IniService.IRacingRunning()) { Check("iRacing must be closed for this test", false); throw new InvalidOperationException("sim running"); }

            // ----- the app's rename: old-named backup folders are renamed, with their files -----
            var oldIr = Path.Combine(docs, Paths.OldBackupsFolderName);
            var oldLmu = Paths.LmuOverride == null ? null : Paths.OldBackupsFolderNames.Select(n => Path.Combine(Paths.LmuOverride, "UserData", n)).FirstOrDefault(Directory.Exists);
            bool hadOldIr = Directory.Exists(oldIr), hadOldLmu = oldLmu != null && Directory.Exists(oldLmu);
            SimService.MigrateBackupFolders();
            if (hadOldIr) Check("iRacing: old-named backup folder renamed with its files", !Directory.Exists(oldIr) && Directory.GetFiles(Paths.Backups, "*.ini").Length == 2, Paths.Backups);
            if (hadOldLmu) Check("LMU: old-named backup folder renamed with its files", !Directory.Exists(oldLmu!) && Directory.GetFiles(SimService.BackupsDir(SimService.Lmu)!).Length == 3, SimService.BackupsDir(SimService.Lmu) ?? "");

            // ----- iRacing -----
            var before = BackupService.List().Where(i => (string)i.GetType().GetProperty("sim")!.GetValue(i)! == "iracing").ToArray();
            Check("iRacing: lists the prepared backup", before.Length == 1, $"found {before.Length}");

            var (ok, msg, backup) = IniService.Write("rendererDX11Monitor.ini", "WRITTEN");
            Check("iRacing: write succeeds", ok, msg);
            Check("iRacing: write made a backup in the tuner folder", backup != null && File.Exists(backup) && Path.GetDirectoryName(backup) == Paths.Backups, backup ?? "");
            Check("iRacing: live file now has the new text", File.ReadAllText(live) == "WRITTEN");
            Check("iRacing: no temp file left behind", !File.Exists(live + ".tuner-tmp"));
            Check("iRacing: no loose backup left in the iRacing folder", Directory.GetFiles(docs, "*.ini").All(f => !Path.GetFileName(f).Contains(" 20")));

            var (rok, rmsg) = BackupService.Restore("iracing", "rendererDX11Monitor 2026-11-17 17-28-48.ini");
            Check("iRacing: restore succeeds", rok, rmsg);
            Check("iRacing: restore put the old text back", File.ReadAllText(live) == "OLD");
            Check("iRacing: restore backed up the file it replaced", BackupService.List().Any(i => i.ToString()!.Contains("before restore")), "");
            Check("iRacing: restore refuses a path trick", !BackupService.Restore("iracing", @"..\app.ini").ok);
            Check("iRacing: restore refuses a VR file", !BackupService.Restore("iracing", "rendererDX11OpenXR 2026-11-17 17-28-48.ini").ok);

            var loose = BackupService.ScanLoose();
            Check("iRacing: finds the 2 loose monitor backups only", loose.Length == 2, $"found {loose.Length}");
            var names = loose.Select(l => (string)l.GetType().GetProperty("file")!.GetValue(l)!).ToList();
            names.Add(@"..\app.ini"); names.Add("app.ini.bak"); names.Add("rendererDX11OpenXR.ini.backup-2026");
            var (moved, failed) = BackupService.MoveLoose(names);
            Check("iRacing: moves the 2 loose backups", moved == 2, $"moved {moved}");
            Check("iRacing: refuses a path trick, a non-renderer file and a VR backup", failed == 3, $"failed {failed}");
            Check("iRacing: moved files are in the subfolder", Directory.Exists(Path.Combine(Paths.Backups, BackupService.MovedFolder)) &&
                Directory.GetFiles(Path.Combine(Paths.Backups, BackupService.MovedFolder)).Length == 2);
            Check("iRacing: untouched files stayed put", File.Exists(Path.Combine(docs, "app.ini.bak")) && File.Exists(Path.Combine(docs, "rendererDX11OpenXR.ini.backup-2026")));

            // ----- Le Mans Ultimate -----
            if (Paths.LmuOverride != null)
            {
                var lmu = SimService.Lmu; var root = Paths.LmuOverride;
                var vid = Path.Combine(root, @"UserData\Config_DX11.ini"); var gfx = Path.Combine(root, @"UserData\player\Settings.JSON");
                var bdir = SimService.BackupsDir(lmu)!;
                var d = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "lmu");
                Check("LMU: found, with both files", (bool)d.GetType().GetProperty("found")!.GetValue(d)!);
                Check("LMU: backups folder sits inside UserData", bdir == Path.Combine(root, @"UserData\" + Paths.BackupsFolderName), bdir);
                var lmuBefore = BackupService.List().Where(i => (string)i.GetType().GetProperty("sim")!.GetValue(i)! == "lmu").ToArray();
                Check("LMU: lists its 2 backups and ignores the VR one", lmuBefore.Length == 2, $"found {lmuBefore.Length}");
                var read = SimService.ReadAll(lmu);
                Check("LMU: reads both files", read.Length == 2 && File.ReadAllText(vid) == "V1" && File.ReadAllText(gfx) == "J1");

                var w = SimService.WriteSet(lmu, new[] { (lmu.Files[0], "V2"), (lmu.Files[1], "J2") });
                Check("LMU: writes both files", w.ok && File.ReadAllText(vid) == "V2" && File.ReadAllText(gfx) == "J2", w.message);
                Check("LMU: made a backup of each", Directory.GetFiles(bdir, "Config_DX11 2026-*.ini").Length >= 2 && Directory.GetFiles(bdir, "Settings 2026-*.JSON").Length >= 2);
                Check("LMU: no temp files left behind", !File.Exists(vid + ".tuner-tmp") && !File.Exists(gfx + ".tuner-tmp"));

                // second file cannot be written: the first must be put back
                File.SetAttributes(gfx, FileAttributes.ReadOnly);
                var w2 = SimService.WriteSet(lmu, new[] { (lmu.Files[0], "V3"), (lmu.Files[1], "J3") });
                File.SetAttributes(gfx, FileAttributes.Normal);
                Check("LMU: a failed second write is reported", !w2.ok, w2.message);
                Check("LMU: ...and the first file is rolled back", File.ReadAllText(vid) == "V2" && File.ReadAllText(gfx) == "J2", $"video={File.ReadAllText(vid)} graphics={File.ReadAllText(gfx)}");

                var rr = BackupService.Restore("lmu", "Settings 2026-11-17 17-28-48.JSON");
                Check("LMU: restore succeeds", rr.ok && File.ReadAllText(gfx) == "JOLD", rr.message);
                Check("LMU: restore backed up the file it replaced", Directory.GetFiles(bdir, "Settings * before restore.JSON").Length == 1);
                Check("LMU: restore refuses the VR backup", !BackupService.Restore("lmu", "Config_DX11_VR 2026-11-17 17-28-48.ini").ok);
                Check("LMU: restore refuses a path trick", !BackupService.Restore("lmu", @"..\player\Settings.JSON").ok);
                Check("LMU: the app never lists or touches the VR config", !SimService.TargetValid(lmu, "Config_DX11_VR.ini"));
            }
        }
        catch (Exception ex) { Check("test ran to the end", false, ex.Message); }
        File.WriteAllText(Path.Combine(Paths.Data, "selftest-backups.json"), JsonSerializer.Serialize(checks, new JsonSerializerOptions { WriteIndented = true }));
    }

    // ---------- update self test: `Dialed.exe --selftest-update --data=<throwaway> --update-test-url=http://localhost:8799/` ----------
    // Runs the updater against a pretend release server prepared by the tester: good updates, and every kind of bad one.
    async Task RunUpdateSelfTestAsync(string baseUrl)
    {
        var checks = new List<object>();
        void Check(string name, bool pass, string detail = "") => checks.Add(new { name, pass, detail });
        async Task<(UpdateInfo? info, string? err)> Look(string file)
        {
            UpdateService.TestManifestUrl = baseUrl + file;
            try { return (await UpdateService.CheckAsync(), null); } catch (Exception ex) { return (null, ex.Message); }
        }
        async Task<string?> Apply(UpdateInfo info) { try { await UpdateService.ApplyAsync(info); return null; } catch (Exception ex) { return ex.Message; } }
        try
        {
            var bundled = UpdateService.CurrentVersion();
            Check("starts on the bundled version", bundled == "0.1.0" && UpdateService.ActiveWeb() == UpdateService.Bundled, bundled);

            var same = await Look("latest-same.json");
            Check("no update offered when already on the latest", same.info == null && same.err == null, same.err ?? "");

            var n2 = await Look("latest-0.2.0.json");
            Check("a newer release is offered", n2.info?.Version == "0.2.0", n2.err ?? n2.info?.Version ?? "none");
            var e = n2.info != null ? await Apply(n2.info) : "no info";
            Check("a good update installs", e == null, e ?? "");
            Check("the app then uses the downloaded page", UpdateService.CurrentVersion() == "0.2.0" && UpdateService.ActiveWeb() != UpdateService.Bundled, UpdateService.CurrentVersion());
            Check("the downloaded files are really there", File.Exists(Path.Combine(UpdateService.ActiveWeb(), "update-marker-0.2.0.txt")));

            var n3 = await Look("latest-0.3.0.json");
            e = n3.info != null ? await Apply(n3.info) : "no info";
            Check("a second update installs on top", e == null && UpdateService.CurrentVersion() == "0.3.0", e ?? UpdateService.CurrentVersion());
            Check("going back one version returns to 0.2.0", UpdateService.Revert() && UpdateService.CurrentVersion() == "0.2.0", UpdateService.CurrentVersion());
            Check("going back again returns to the bundled page", UpdateService.Revert() && UpdateService.CurrentVersion() == "0.1.0" && UpdateService.ActiveWeb() == UpdateService.Bundled, UpdateService.CurrentVersion());

            // everything below must be refused, and must leave the installed version alone
            foreach (var (file, expect) in new[]
            {
                ("latest-badhash.json", "checksum"), ("latest-slip.json", "unsafe"), ("latest-exe.json", "program file"),
                ("latest-minhost.json", "newer version of the program"), ("latest-badurl.json", "not the project's releases"),
            })
            {
                var l = await Look(file);
                var err = l.err ?? (l.info != null ? await Apply(l.info) : "no info");
                Check($"refused: {file}", err != null && err.Contains(expect, StringComparison.OrdinalIgnoreCase), err ?? "it was accepted!");
            }
            Check("nothing was installed by the refused ones", UpdateService.CurrentVersion() == "0.1.0" && !UpdateService.CanRevert);
            Check("the unsafe zip wrote nothing outside its folder", !File.Exists(Path.Combine(Paths.Data, "evil.txt")) && !File.Exists(Path.Combine(Path.GetDirectoryName(Paths.Data)!, "evil.txt")));
            Check("no staging or download files left behind", !Directory.GetFileSystemEntries(Path.Combine(Paths.Data, "content")).Any(x => Path.GetFileName(x).StartsWith("staging-") || Path.GetFileName(x).StartsWith("download-")));
        }
        catch (Exception ex) { Check("test ran to the end", false, ex.Message); }
        File.WriteAllText(Path.Combine(Paths.Data, "selftest-update.json"), JsonSerializer.Serialize(checks, new JsonSerializerOptions { WriteIndented = true }));
    }

    // ---------- self test: `iRGraphicsTuner.exe --selftest` ----------
    async Task RunSelfTest()
    {
        await Task.Delay(2500); // let the page say hello and receive its answers
        var js = @"JSON.stringify({
            host: !!window.TunerHost,
            panelShown: !!document.getElementById('appPanel') && !document.getElementById('appPanel').hidden,
            iniOptions: document.getElementById('iniSelect') ? document.getElementById('iniSelect').options.length : -1,
            iniLoaded: window.TunerApp ? window.TunerApp.state.iniName : null,
            sim: window.TunerApp ? window.TunerApp.state.sim.id : null,
            pickerButtons: document.querySelectorAll('#simPicker button').length,
            logos: window.TunerLogos ? Object.keys(window.TunerLogos) : [],
            hotkeyShown: document.getElementById('hotkeyBox') ? document.getElementById('hotkeyBox').value : null,
            storage: (function(){ try { localStorage.setItem('t','1'); return localStorage.getItem('t')==='1'; } catch(e) { return false; } })(),
            origin: location.origin
        })";
        var result = await web.CoreWebView2.ExecuteScriptAsync(js);
        var report = new
        {
            page = JsonSerializer.Deserialize<string>(result),
            hotkeyStatus = hotkeyStatus == "" ? "registered " + settings.Hotkey.Text : hotkeyStatus,
            presentMonBundled = File.Exists(Paths.PresentMon),
            vramTotalMB = Vram.TotalBytes() / 1048576,
            iniFiles = IniService.List().Length,
            sims = SimService.Describe().Select(s => new { id = s.GetType().GetProperty("id")!.GetValue(s), found = s.GetType().GetProperty("found")!.GetValue(s), hasLogo = s.GetType().GetProperty("logo")!.GetValue(s) != null }),
        };
        File.WriteAllText(Path.Combine(Paths.Data, "selftest.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Close();
    }
}
