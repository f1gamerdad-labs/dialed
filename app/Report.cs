using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace TunerApp;

/// <summary>
/// "Report a problem": builds a zip the user can share (log, versions, optionally captures and graphics settings) and posts the short message
/// plus a text summary to the project's feedback form. Nothing is sent without the user pressing the button, and the zip itself is never uploaded.
/// </summary>
static class ReportService
{
    // The same Google Form as the Ideas button; bug reports are marked with a [BUG REPORT] prefix in the idea box.
    public const string FormUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfWQH6XsDcVcv5LVPNrQJKNKbrWUwWSaYq1-rCQd3Aq7Z3zEA/formResponse";
    const string IdeaField = "entry.136963780", ContactField = "entry.1224842850";
    const long CaptureBudget = 20L * 1024 * 1024; // keep the zip small enough to attach to an email or Discord message
    const int MaxCaptures = 15;

    public static string ReportsDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Dialed", "Reports");

    public static string SystemText(SimDef sim, string? lastIni)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Dialed host {UpdateService.HostVersion}, page {UpdateService.CurrentVersion()}");
        sb.AppendLine($"Windows {Environment.OSVersion.Version} ({(Environment.Is64BitOperatingSystem ? "64" : "32")}-bit), {Environment.ProcessorCount} logical CPUs");
        try { sb.AppendLine($"Memory {Math.Round(GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / 1073741824.0, 1)} GB"); } catch { }
        sb.AppendLine("Graphics " + (GpuName() ?? "unknown"));
        sb.AppendLine($"Sim {sim.Name} ({sim.Id}); last renderer file {lastIni ?? "n/a"}");
        sb.AppendLine($"Sim running now: {SimService.IsRunning(sim)}");
        return sb.ToString();
    }

    static string? GpuName()
    {
        try
        {
            // Windows lists every graphics adapter that has run Direct3D here, with a readable name.
            using var dx = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\DirectX");
            var names = new List<string>();
            foreach (var k in dx?.GetSubKeyNames() ?? Array.Empty<string>())
            {
                using var sub = dx!.OpenSubKey(k);
                if (sub?.GetValue("Description") is string d && !d.StartsWith("Microsoft Basic", StringComparison.OrdinalIgnoreCase)) names.Add(d);
            }
            return names.Count == 0 ? null : string.Join("; ", names);
        }
        catch { return null; }
    }

    static void AddText(ZipArchive zip, string name, string text)
    {
        var e = zip.CreateEntry(name, CompressionLevel.Optimal);
        using var w = new StreamWriter(e.Open(), new UTF8Encoding(false));
        w.Write(text);
    }

    static void AddFile(ZipArchive zip, string name, string path)
    {
        try
        {
            var e = zip.CreateEntry(name, CompressionLevel.Optimal);
            using var src = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var dst = e.Open();
            src.CopyTo(dst);
        }
        catch (Exception ex) { Paths.Log_($"report: could not add {name}: {ex.Message}"); }
    }

    /// <summary>Only the graphics section of LMU's Settings.JSON goes in the report, because the rest of that file holds the player's profile.</summary>
    static string? GraphicsOnly(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("Graphic Options", out var g)) return null;
            return JsonSerializer.Serialize(new Dictionary<string, JsonElement> { ["Graphic Options"] = g }, new JsonSerializerOptions { WriteIndented = true });
        }
        catch { return null; }
    }

    /// <summary>Writes the zip and returns its path.</summary>
    public static string Build(string message, string contact, bool withData, bool withSettings, string pageState, SimDef sim, string? lastIni)
    {
        Directory.CreateDirectory(ReportsDir);
        var path = Path.Combine(ReportsDir, $"Dialed-report-{DateTime.Now:yyyy-MM-dd-HHmmss}.zip");
        using var fs = new FileStream(path, FileMode.CreateNew);
        using var zip = new ZipArchive(fs, ZipArchiveMode.Create);
        AddText(zip, "message.txt", $"{message}\r\n\r\nContact: {(string.IsNullOrWhiteSpace(contact) ? "(none given)" : contact)}\r\n");
        AddText(zip, "system.txt", SystemText(sim, lastIni));
        foreach (var log in new[] { "app.log", "app.log.1" })
        {
            var p = Path.Combine(Paths.Data, log);
            if (File.Exists(p)) AddFile(zip, "logs/" + log, p);
        }
        if (withData)
        {
            AddText(zip, "page-state.json", pageState);
            long used = 0; int n = 0;
            if (Directory.Exists(Paths.Captures))
                foreach (var f in new DirectoryInfo(Paths.Captures).GetFiles().OrderByDescending(x => x.LastWriteTime))
                {
                    if (n >= MaxCaptures || used + f.Length > CaptureBudget) continue;
                    AddFile(zip, "captures/" + f.Name, f.FullName); used += f.Length; n++;
                }
            AddText(zip, "captures/README.txt", $"{n} most recent capture file(s) included (limit {MaxCaptures} files / {CaptureBudget / 1048576} MB).\r\n");
        }
        if (withSettings)
        {
            if (sim.Id == "iracing")
            {
                if (!string.IsNullOrEmpty(lastIni)) { try { AddText(zip, "settings/" + lastIni, IniService.Read(lastIni)); } catch { } }
            }
            else
                foreach (var o in SimService.ReadAll(sim))
                {
                    var e = JsonSerializer.SerializeToElement(o);
                    if (e.GetProperty("missing").GetBoolean()) continue;
                    var name = e.GetProperty("name").GetString() ?? "file";
                    var text = e.GetProperty("text").GetString() ?? "";
                    if (name.EndsWith(".JSON", StringComparison.OrdinalIgnoreCase)) text = GraphicsOnly(text) ?? "(could not read the graphics section)";
                    AddText(zip, "settings/" + name, text);
                }
        }
        return path;
    }

    /// <summary>Posts the message and a text summary to the feedback form. Returns false if it could not be sent (offline, form changed).</summary>
    public static async Task<bool> PostAsync(string message, string contact, string summary)
    {
        try
        {
            var text = "[BUG REPORT] " + message.Trim() + "\n\n" + summary;
            if (text.Length > 9000) text = text.Substring(0, 9000) + "\n...(cut)";
            var fields = new List<KeyValuePair<string, string>> { new(IdeaField, text) };
            if (!string.IsNullOrWhiteSpace(contact)) fields.Add(new(ContactField, contact.Trim()));
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };
            using var resp = await http.PostAsync(FormUrl, new FormUrlEncodedContent(fields));
            var code = (int)resp.StatusCode;
            Paths.Log_("report posted to form: HTTP " + code);
            return code >= 200 && code < 400;
        }
        catch (Exception ex) { Paths.Log_("report post failed: " + ex.Message); return false; }
    }
}
