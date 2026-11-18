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
        SoundPack.UseVoice = settings.CueVoice;
        Paths.Log_($"start: Dialed host {UpdateService.HostVersion}, page {UpdateService.CurrentVersion()}, Windows {Environment.OSVersion.Version}");
        if (!string.IsNullOrWhiteSpace(settings.UpdateRepo)) UpdateService.RepoSlug = settings.UpdateRepo!;
        if (args.Contains("--selftest-update") && Paths.DataOverride != null && Arg("--update-test-url") is { } testUrl)
        {
            Load += async (_, _) => { await RunUpdateSelfTestAsync(testUrl); Close(); };
            return;
        }
        if (Arg("--selftest-sounds") is { } soundDir && Paths.DataOverride != null) // reports which spoken cues in a folder are found and are playable WAV files
        {
            Load += (_, _) =>
            {
                SoundPack.FolderOverride = soundDir; SoundPack.ForgetAll();
                var found = SoundPack.Names.Select(n =>
                {
                    var p = SoundPack.Find(n); bool playable = false;
                    if (p != null) { try { using var sp = new System.Media.SoundPlayer(p); sp.Load(); playable = true; } catch { } }
                    return new { name = n, exists = p != null, playable, bytes = p != null ? new FileInfo(p).Length : 0L, played = SoundPack.Play(n) };
                }).ToArray();
                File.WriteAllText(Path.Combine(Paths.Data, "selftest-sounds.json"), JsonSerializer.Serialize(found));
                Close();
            };
            return;
        }
        if (args.Contains("--selftest-hang")) // a window whose thread never reads messages, to stand in for a frozen game
        {
            Text = "frozen test window"; ClientSize = new Size(300, 120);
            Shown += (_, _) => System.Threading.Thread.Sleep(180000); // the window is on screen, then its thread stops reading messages
            return;
        }
        if (Arg("--selftest-close") is { } closeName && Paths.DataOverride != null) // closes a throwaway process by name (hung or healthy) and reports how it went
        {
            Load += async (_, _) =>
            {
                var sw = Stopwatch.StartNew();
                var r = await SimService.CloseProcessesAsync(new[] { closeName }, "Test game", () => System.Diagnostics.Process.GetProcessesByName(closeName).Length > 0, 25000, 6000);
                File.WriteAllText(Path.Combine(Paths.Data, "selftest-close.json"), JsonSerializer.Serialize(new { r.ok, r.message, seconds = Math.Round(sw.Elapsed.TotalSeconds, 1), stillRunning = System.Diagnostics.Process.GetProcessesByName(closeName).Length }));
                Close();
            };
            return;
        }
        if (Arg("--selftest-vram") is { } vramPid && int.TryParse(vramPid, out var vpid) && Paths.DataOverride != null) // samples a running process's graphics memory three times and reports it
        {
            Load += async (_, _) =>
            {
                using var s = new Vram.Sampler(vpid);
                for (int i = 0; i < 3; i++) { s.Sample(); await Task.Delay(500); }
                File.WriteAllText(Path.Combine(Paths.Data, "selftest-vram.json"), JsonSerializer.Serialize(new { usedMB = Math.Round(s.MaxBytes / 1048576), totalMB = Math.Round(Vram.TotalBytes() / 1048576.0) }));
                Close();
            };
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
            Paths.Log_($"hotkey {settings.Hotkey.Text}: " + (hotkeyStatus == "" ? "registered" : "NOT registered (" + hotkeyStatus + ")"));
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
        if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID) { Paths.Log_("hotkey pressed: " + settings.Hotkey.Text); _ = ToggleCaptureAsync(); return; }
        base.WndProc(ref m);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        UnregisterHotKey(Handle, HOTKEY_ID);
        capture?.Cancel();
        base.OnFormClosed(e);
    }

    // ---------- capture ----------
    /// <summary>The game to capture: the one picked in the app if it is running, otherwise the only supported game that is running.
    /// This way the hotkey works in whatever game you are in, even if a different sim is selected in the app.</summary>
    SimDef ChooseCaptureSim()
    {
        if (SimService.IsRunning(currentSim)) return currentSim;
        var running = SimService.All.Where(s => !s.ComingSoon && SimService.IsRunning(s)).ToList();
        return running.Count == 1 ? running[0] : currentSim;
    }

    async Task ToggleCaptureAsync()
    {
        if (capture != null) { Paths.Log_("capture: cancelled by hotkey or button"); capture.Cancel(); if (!SoundPack.Play("cancel")) CaptureService.BeepSeq((520, 220)); return; }
        capture = new CancellationTokenSource();
        var sim = ChooseCaptureSim();
        if (sim != currentSim)
        {
            Paths.Log_($"capture: {currentSim.Name} is selected but {sim.Name} is the game running, so capturing {sim.Name}");
            currentSim = sim; settings.LastSim = sim.Id; settings.Save();
            Post(new { type = "capture", phase = "sim", sim = sim.Id }); // the page switches its picker to match
        }
        Paths.Log_($"capture start: {sim.Name}, {settings.CaptureSeconds}s");
        if (!SoundPack.Has("announce")) CaptureService.BeepSeq((784, 110), (1047, 150)); // "got it", so the press is audible even when the app is hidden behind a full-screen game (the spoken "Capture about to start" does this job when it exists)
        try
        {
            var r = await CaptureService.RunAsync(sim, settings.CaptureSeconds, settings.Countdown, Post, capture.Token);
            Post(new { type = "capture", phase = "done", sim = sim.Id, name = r.Name, text = r.Text, vramUsedBytes = r.VramUsedBytes, vramTotalBytes = r.VramTotalBytes, busy = r.Busy });
        }
        catch (OperationCanceledException) { Post(new { type = "capture", phase = "cancelled" }); }
        catch (Exception ex)
        {
            Paths.Log_("capture error: " + ex.Message);
            if (!SoundPack.Play("error")) CaptureService.BeepSeq((300, 200), (300, 200)); // two low beeps: it did not start
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
                        cueVoice = settings.CueVoice, voiceClips = SoundPack.ClipsExist(),
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
                case "pcCheck":
                {
                    var pid = r.TryGetProperty("id", out var pidp) ? pidp.GetInt32() : 0;
                    _ = Task.Run(() =>
                    {
                        try { Post(new { type = "pcCheck", id = pid, ok = true, facts = PcCheck.Collect() }); Paths.Log_("pc check: done"); }
                        catch (Exception ex) { Paths.Log_("pc check failed: " + ex.Message); Post(new { type = "pcCheck", id = pid, ok = false, message = ex.Message }); }
                    });
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
                case "setCueVoice":
                    settings.CueVoice = r.GetProperty("voice").GetBoolean(); settings.Save();
                    SoundPack.UseVoice = settings.CueVoice; SoundPack.ForgetAll();
                    Paths.Log_("countdown sound: " + (settings.CueVoice ? "voice" : "beeps"));
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
                case "launchSim": // starts a Steam game through Steam, in the user's normal (non-admin) session
                {
                    var s = SimService.ById(r.GetProperty("sim").GetString());
                    var ok = s != null && !s.ComingSoon && s.SteamAppId != null && s.SteamAppId.All(char.IsDigit) && !SimService.IsRunning(s)
                        && Unelevated.OpenTarget("steam://rungameid/" + s.SteamAppId);
                    Paths.Log_($"launch {s?.Name}: {ok}");
                    Post(new { type = "simLaunched", ok });
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
                    Paths.Log_($"hotkey {h.Text}: " + (err == "" ? "registered" : "NOT registered (" + err + ")"));
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
            // ----- shared logs must not reveal the Windows user name -----
            var redacted = ReportService.Redact(@"2026-11-18T05:00:00 moved 3 backup(s) to C:\Users\sean\Documents\iRacing and D:\x\sean\y; user sean says hi", "sean", @"C:\Users\sean");
            Check("Report: the user name in a profile path is replaced", redacted.Contains(@"C:\Users\USER\Documents\iRacing"), redacted);
            Check("Report: the user name as a folder in another path is replaced, plain words are not", redacted.Contains(@"D:\x\USER\y") && redacted.Contains("user sean says hi"), redacted);
            Check("Report: text without the user name is unchanged", ReportService.Redact("capture start: RaceRoom, 60s", "sean", @"C:\Users\sean") == "capture start: RaceRoom, 60s");

            // ----- graphics memory sanity rule (RaceRoom reported 43,683 MB "dedicated" on an 8 GB card) -----
            const double MB = 1048576.0;
            Check("VRAM: a normal game keeps its dedicated figure (7265 MB of 7800 in use on the card)", Vram.Sampler.Plausible(7265 * MB, 6900 * MB, 7800 * MB, 8192L * 1048576) == 7265 * MB);
            Check("VRAM: an impossible figure (43,683 MB when the card uses 4,817) falls back to the resident figure", Vram.Sampler.Plausible(43683 * MB, 2696 * MB, 4817 * MB, 8192L * 1048576) == 2696 * MB);
            Check("VRAM: with no adapter figure, more than 125% of the card is rejected", Vram.Sampler.Plausible(43683 * MB, 2696 * MB, null, 8192L * 1048576) == 2696 * MB);
            Check("VRAM: with no adapter figure, a plausible value is kept", Vram.Sampler.Plausible(7000 * MB, 6000 * MB, null, 8192L * 1048576) == 7000 * MB);
            Check("VRAM: with nothing else to go on the original figure is kept", Vram.Sampler.Plausible(43683 * MB, null, 4817 * MB, 8192L * 1048576) == 43683 * MB);

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

            // ----- Automobilista 2 (--sim-ams2=<throwaway folder holding graphicsconfigdx11.xml and the VR xml files>) -----
            if (Paths.SimOverrides.TryGetValue("ams2", out var aroot))
            {
                var ams2 = SimService.Ams2;
                var xml = Path.Combine(aroot, "graphicsconfigdx11.xml");
                var d = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "ams2");
                Check("AMS2: found", (bool)d.GetType().GetProperty("found")!.GetValue(d)! && !(bool)d.GetType().GetProperty("comingSoon")!.GetValue(d)!);
                var bdir = SimService.BackupsDir(ams2)!;
                Check("AMS2: backups folder sits next to the xml", bdir == Path.Combine(aroot, Paths.BackupsFolderName), bdir);
                Check("AMS2: both exe names are watched", ams2.ProcessNames.SequenceEqual(new[] { "AMS2", "AMS2AVX" }));
                var original = File.ReadAllBytes(xml);
                var read = SimService.ReadAll(ams2);
                Check("AMS2: reads the file", read.Length == 1 && File.ReadAllBytes(xml).SequenceEqual(original));
                var w = SimService.Write(ams2, ams2.Files[0], "<changed/>");
                Check("AMS2: write succeeds with a backup", w.ok && File.ReadAllText(xml) == "<changed/>" && w.backup != null && File.ReadAllBytes(w.backup).SequenceEqual(original), w.message);
                Check("AMS2: no temp file left", !File.Exists(xml + ".tuner-tmp"));
                var listed = BackupService.List().Where(i => (string)i.GetType().GetProperty("sim")!.GetValue(i)! == "ams2").ToArray();
                Check("AMS2: lists its backup (xml extension)", listed.Length == 1, $"found {listed.Length}");
                var rr = BackupService.Restore("ams2", Path.GetFileName(w.backup!));
                Check("AMS2: restore puts the original bytes back", rr.ok && File.ReadAllBytes(xml).SequenceEqual(original), rr.message);
                Check("AMS2: restore refuses a path trick", !BackupService.Restore("ams2", @"..\graphicsconfigdx11.xml").ok);
                Check("AMS2: the app never touches a VR file", !SimService.TargetValid(ams2, "graphicsconfigopenvrdx11.xml") && !SimService.TargetValid(ams2, "oculussettings.xml"));
                if (Paths.SimOverrides.TryGetValue("acc", out var croot)) // --sim-acc=<throwaway folder holding Config\menuSettings.json>
                {
                    var acc = SimService.Acc; var json = Path.Combine(croot, @"Config\menuSettings.json");
                    var cd = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "acc");
                    Check("ACC: found and switched on", (bool)cd.GetType().GetProperty("found")!.GetValue(cd)! && !(bool)cd.GetType().GetProperty("comingSoon")!.GetValue(cd)!);
                    var cb = SimService.BackupsDir(acc)!;
                    Check("ACC: backups folder sits in the ACC documents folder, not in Config", cb == Path.Combine(croot, Paths.BackupsFolderName), cb);
                    var corig = File.ReadAllBytes(json);
                    Check("ACC: reads the file unchanged", SimService.ReadAll(acc).Length == 1 && File.ReadAllBytes(json).SequenceEqual(corig));
                    var cw = SimService.Write(acc, acc.Files[0], "{}");
                    Check("ACC: write succeeds with a byte-exact backup", cw.ok && File.ReadAllText(json) == "{}" && cw.backup != null && File.ReadAllBytes(cw.backup).SequenceEqual(corig), cw.message);
                    Check("ACC: lists its backup (.json)", BackupService.List().Count(i => (string)i.GetType().GetProperty("sim")!.GetValue(i)! == "acc") == 1);
                    var crr = BackupService.Restore("acc", Path.GetFileName(cw.backup!));
                    Check("ACC: restore puts the original bytes back", crr.ok && File.ReadAllBytes(json).SequenceEqual(corig), crr.message);
                    Check("ACC: restore refuses a path trick", !BackupService.Restore("acc", @"..\Config\menuSettings.json").ok);
                }
                if (Paths.SimOverrides.TryGetValue("beamng", out var broot)) // --sim-beamng=<throwaway folder holding BeamNG.drive\current\settings\settings.json>
                {
                    var bng = SimService.BeamNg; var bjson = Path.Combine(broot, @"BeamNG.drive\current\settings\settings.json");
                    var bd = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "beamng");
                    Check("BeamNG: found and switched on", (bool)bd.GetType().GetProperty("found")!.GetValue(bd)! && !(bool)bd.GetType().GetProperty("comingSoon")!.GetValue(bd)!);
                    var bb = SimService.BackupsDir(bng)!;
                    Check("BeamNG: backups sit outside the game's user folder", bb == Path.Combine(broot, Paths.BackupsFolderName), bb);
                    var borig = File.ReadAllBytes(bjson);
                    var bw = SimService.Write(bng, bng.Files[0], "{}");
                    Check("BeamNG: write succeeds with a byte-exact backup", bw.ok && bw.backup != null && File.ReadAllBytes(bw.backup).SequenceEqual(borig), bw.message);
                    var brr = BackupService.Restore("beamng", Path.GetFileName(bw.backup!));
                    Check("BeamNG: restore puts the original bytes back", brr.ok && File.ReadAllBytes(bjson).SequenceEqual(borig), brr.message);
                }
                if (Paths.SimOverrides.TryGetValue("pmr", out var proot)) // --sim-pmr=<throwaway folder holding savegame1\settings.xml>
                {
                    var pm = SimService.Pmr; var px = Path.Combine(proot, @"savegame1\settings.xml");
                    var pd = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "pmr");
                    Check("PMR: found and switched on", (bool)pd.GetType().GetProperty("found")!.GetValue(pd)! && !(bool)pd.GetType().GetProperty("comingSoon")!.GetValue(pd)!);
                    Check("PMR: watches the game and the launcher", pm.ProcessNames.SequenceEqual(new[] { "ProjectMotorRacingGame", "ProjectMotorRacing" }));
                    var porig = File.ReadAllBytes(px);
                    var pw = SimService.Write(pm, pm.Files[0], "<x/>");
                    Check("PMR: write succeeds with a byte-exact backup", pw.ok && pw.backup != null && File.ReadAllBytes(pw.backup).SequenceEqual(porig) && Path.GetDirectoryName(pw.backup) == Path.Combine(proot, Paths.BackupsFolderName), pw.message);
                    var prr = BackupService.Restore("pmr", Path.GetFileName(pw.backup!));
                    Check("PMR: restore puts the original bytes back", prr.ok && File.ReadAllBytes(px).SequenceEqual(porig), prr.message);
                }
                if (Paths.SimOverrides.TryGetValue("raceroom", out var rrroot)) // --sim-raceroom=<throwaway folder holding UserData\graphics_options.xml>
                {
                    var rrSim = SimService.RaceRoom; var rx = Path.Combine(rrroot, @"UserData\graphics_options.xml");
                    var rd = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "raceroom");
                    Check("RaceRoom: found and switched on", (bool)rd.GetType().GetProperty("found")!.GetValue(rd)! && !(bool)rd.GetType().GetProperty("comingSoon")!.GetValue(rd)!);
                    var rorig = File.ReadAllBytes(rx);
                    var rw = SimService.Write(rrSim, rrSim.Files[0], "<x/>");
                    Check("RaceRoom: write succeeds with a byte-exact backup outside UserData", rw.ok && rw.backup != null && File.ReadAllBytes(rw.backup).SequenceEqual(rorig) && Path.GetDirectoryName(rw.backup) == Path.Combine(rrroot, Paths.BackupsFolderName), rw.message);
                    var rrr = BackupService.Restore("raceroom", Path.GetFileName(rw.backup!));
                    Check("RaceRoom: restore puts the original bytes back", rrr.ok && File.ReadAllBytes(rx).SequenceEqual(rorig), rrr.message);
                }
                if (Paths.SimOverrides.TryGetValue("acevo", out var eroot)) // --sim-acevo=<throwaway folder holding video.videosettings>
                {
                    var ev = SimService.AcEvo; var ef = Path.Combine(eroot, "video.videosettings");
                    var ed = SimService.Describe().First(x => (string)x.GetType().GetProperty("id")!.GetValue(x)! == "acevo");
                    Check("AC EVO: found and switched on", (bool)ed.GetType().GetProperty("found")!.GetValue(ed)! && !(bool)ed.GetType().GetProperty("comingSoon")!.GetValue(ed)!);
                    var eorig = File.ReadAllBytes(ef);
                    Check("AC EVO: binary file reads without changing a byte", SimService.ReadAll(ev).Length == 1 && File.ReadAllBytes(ef).SequenceEqual(eorig));
                    // write bytes that include 0x00 and 0xFF to prove the binary file survives the text round trip exactly
                    var back = (string)SimService.ReadAll(ev)[0].GetType().GetProperty("text")!.GetValue(SimService.ReadAll(ev)[0])!;
                    var ew = SimService.Write(ev, ev.Files[0], back);
                    Check("AC EVO: writing back the same content leaves the binary file byte-identical", ew.ok && File.ReadAllBytes(ef).SequenceEqual(eorig), ew.message);
                    Check("AC EVO: backup is byte-exact and sits beside the video file", ew.backup != null && File.ReadAllBytes(ew.backup).SequenceEqual(eorig) && Path.GetDirectoryName(ew.backup) == Path.Combine(eroot, Paths.BackupsFolderName));
                    var elist = BackupService.List().Where(i => (string)i.GetType().GetProperty("sim")!.GetValue(i)! == "acevo").ToArray();
                    Check("AC EVO: lists its backup (.videosettings extension)", elist.Length == 1, $"found {elist.Length}");
                    File.WriteAllBytes(ef, new byte[] { 1, 2, 3 });
                    var err = BackupService.Restore("acevo", Path.GetFileName(ew.backup!));
                    Check("AC EVO: restore puts the original bytes back", err.ok && File.ReadAllBytes(ef).SequenceEqual(eorig), err.message);
                    Check("AC EVO: restore refuses a path trick", !BackupService.Restore("acevo", @"..\video.videosettings").ok);
                }
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
