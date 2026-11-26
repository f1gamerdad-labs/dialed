using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;

namespace TunerApp;

/// <summary>
/// One release from latest.json. Host is the program version this release ships with; when it is newer than the running program,
/// the update cannot be a page update, so the release's installer (InstallerUrl, checked against InstallerSha256) is used instead.
/// </summary>
sealed record UpdateInfo(string Version, string[] Notes, string ContentUrl, string Sha256, string MinHost, long Size,
    string Host = "0.0.0", string InstallerUrl = "", string InstallerSha256 = "", long InstallerSize = 0)
{
    /// <summary>The page in this release needs a newer program than the one running.</summary>
    public bool NeedsProgram => System.Version.Parse(MinHost) > System.Version.Parse(UpdateService.HostVersion);
    /// <summary>The release carries what is needed to update the program itself.</summary>
    public bool HasInstaller => InstallerUrl.Length > 0 && InstallerSha256.Length == 64;
}

/// <summary>
/// In-app updates for the part of the app that changes most: the page, the design, and the settings tables.
/// It only ever talks to the project's GitHub releases over HTTPS, checks every download against a SHA-256 in the
/// release's manifest, refuses anything unsafe, and keeps the previous version so an update can be undone.
/// </summary>
static class UpdateService
{
    /// <summary>The program itself. It changes only for the rarer updates that need a new download.</summary>
    public const string HostVersion = "0.10.5";
    /// <summary>"owner/repo" of the project's GitHub repository. Updates are switched off until this is set.</summary>
    public static string RepoSlug = "f1gamerdad-labs/dialed";
    /// <summary>Self-test only: a manifest address on this PC (http://localhost allowed).</summary>
    public static string? TestManifestUrl;

    public static bool Configured => TestManifestUrl != null || !RepoSlug.StartsWith("OWNER/", StringComparison.Ordinal);

    static string Root => Path.Combine(Paths.Data, "content");
    static string Current => Path.Combine(Root, "current");
    static string Previous => Path.Combine(Root, "previous");
    public static string Bundled => Path.Combine(AppContext.BaseDirectory, "web");
    public static string ManifestUrl => TestManifestUrl ?? $"https://github.com/{RepoSlug}/releases/latest/download/latest.json";

    const long MaxDownload = 40L * 1024 * 1024, MaxUnpacked = 80L * 1024 * 1024;
    const int MaxEntries = 400;
    static readonly string[] MustContain = { "index.html", "app.js", "core.js", "sims.js", "bridge.js", "styles.css", "version.json" };

    // ---------- what is installed ----------
    static (Version version, Version minHost)? Read(string folder)
    {
        try
        {
            if (!MustContain.All(f => File.Exists(Path.Combine(folder, f)))) return null;
            using var doc = JsonDocument.Parse(File.ReadAllText(Path.Combine(folder, "version.json")));
            return (Version.Parse(doc.RootElement.GetProperty("version").GetString()!), Version.Parse(doc.RootElement.GetProperty("minHost").GetString()!));
        }
        catch { return null; }
    }

    /// <summary>The page the app should show: the downloaded one if it is newer than the bundled one and fits this program, else the bundled one.</summary>
    public static string ActiveWeb()
    {
        var bundled = Read(Bundled); var cur = Read(Current);
        if (cur is { } c && Version.Parse(HostVersion) >= c.minHost && (bundled is null || c.version > bundled.Value.version)) return Current;
        return Bundled;
    }
    public static string CurrentVersion() => (Read(ActiveWeb())?.version ?? new Version(0, 0, 0)).ToString(3);
    public static bool CanRevert => Directory.Exists(Current) && Read(Current) != null;

    // ---------- checking ----------
    static bool AllowedUrl(Uri u)
    {
        if (TestManifestUrl != null && u.Host == "localhost") return true;
        if (u.Scheme != Uri.UriSchemeHttps) return false;
        var h = u.Host.ToLowerInvariant();
        return h == "github.com" || h == "objects.githubusercontent.com" || h.EndsWith(".githubusercontent.com");
    }

    static HttpClient NewClient()
    {
        var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Dialed/" + HostVersion); // generic: nothing about the user is sent
        return http;
    }

    /// <summary>GET that follows redirects by hand, so every hop is checked against the allowed addresses.</summary>
    static async Task<HttpResponseMessage> GetAsync(HttpClient http, Uri uri, CancellationToken ct)
    {
        for (int hop = 0; hop < 6; hop++)
        {
            if (!AllowedUrl(uri)) throw new InvalidOperationException("Refusing to download from an address that is not the project's releases.");
            var resp = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
            if ((int)resp.StatusCode is >= 300 and < 400 && resp.Headers.Location != null) { uri = new Uri(uri, resp.Headers.Location); resp.Dispose(); continue; }
            resp.EnsureSuccessStatusCode();
            return resp;
        }
        throw new InvalidOperationException("Too many redirects.");
    }

    /// <summary>Returns the newer release, or null if this is the latest. Throws if the release cannot be read.</summary>
    public static async Task<UpdateInfo?> CheckAsync(CancellationToken ct = default)
    {
        using var http = NewClient();
        using var resp = await GetAsync(http, new Uri(ManifestUrl), ct);
        var text = await resp.Content.ReadAsStringAsync(ct);
        if (text.Length > 64 * 1024) throw new InvalidOperationException("The release information is unexpectedly large.");
        var info = ParseManifest(text);
        // newer page, or a newer program (the installer carries both)
        return Version.Parse(info.Version) > Version.Parse(CurrentVersion()) || ProgramIsOlder(info) ? info : null;
    }

    public static UpdateInfo ParseManifest(string text)
    {
        using var doc = JsonDocument.Parse(text);
        var r = doc.RootElement;
        string Str(string name, string dflt) => r.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? dflt : dflt;
        return new UpdateInfo(
            r.GetProperty("version").GetString()!, r.TryGetProperty("notes", out var n) ? n.EnumerateArray().Select(x => x.GetString() ?? "").Take(12).ToArray() : Array.Empty<string>(),
            r.GetProperty("contentUrl").GetString()!, r.GetProperty("sha256").GetString()!.ToLowerInvariant(),
            Str("minHost", "0.0.0"), r.TryGetProperty("size", out var s) ? s.GetInt64() : 0,
            Str("host", "0.0.0"), Str("installerUrl", ""), Str("installerSha256", "").ToLowerInvariant(), r.TryGetProperty("installerSize", out var isz) ? isz.GetInt64() : 0);
    }

    /// <summary>The release ships a newer program than the one running (and says how to install it).</summary>
    public static bool ProgramIsOlder(UpdateInfo i) => i.HasInstaller && Version.TryParse(i.Host, out var h) && h > Version.Parse(HostVersion);

    // ---------- applying ----------
    /// <summary>Downloads, verifies, unpacks and installs an update. Throws with a plain message if anything is wrong; nothing is changed in that case.</summary>
    public static async Task ApplyAsync(UpdateInfo info, CancellationToken ct = default)
    {
        if (Version.Parse(info.MinHost) > Version.Parse(HostVersion))
            throw new InvalidOperationException("This update needs a newer version of the program. Download the latest Dialed from the releases page.");
        Directory.CreateDirectory(Root);
        var tmpZip = Path.Combine(Root, $"download-{Guid.NewGuid():N}.zip");
        var stage = Path.Combine(Root, "staging-" + info.Version);
        try
        {
            // 1. download, hashing as we go
            using (var http = NewClient())
            {
                http.Timeout = TimeSpan.FromMinutes(5);
                using var resp = await GetAsync(http, new Uri(info.ContentUrl), ct);
                if (resp.Content.Headers.ContentLength > MaxDownload) throw new InvalidOperationException("The update is larger than expected, so it was not installed.");
                using var sha = SHA256.Create();
                await using var src = await resp.Content.ReadAsStreamAsync(ct);
                await using var dst = File.Create(tmpZip);
                var buf = new byte[81920]; long total = 0; int n;
                while ((n = await src.ReadAsync(buf, ct)) > 0)
                {
                    total += n;
                    if (total > MaxDownload) throw new InvalidOperationException("The update is larger than expected, so it was not installed.");
                    sha.TransformBlock(buf, 0, n, null, 0); await dst.WriteAsync(buf.AsMemory(0, n), ct);
                }
                sha.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                if (!string.Equals(Convert.ToHexString(sha.Hash!), info.Sha256, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("The download did not match its checksum, so it was not installed.");
            }

            // 2. unpack safely
            if (Directory.Exists(stage)) Directory.Delete(stage, true);
            Directory.CreateDirectory(stage);
            var stageFull = Path.GetFullPath(stage) + Path.DirectorySeparatorChar;
            using (var zip = ZipFile.OpenRead(tmpZip))
            {
                if (zip.Entries.Count > MaxEntries || zip.Entries.Sum(e => e.Length) > MaxUnpacked) throw new InvalidOperationException("The update has an unexpected size or shape, so it was not installed.");
                foreach (var e in zip.Entries)
                {
                    if (e.FullName.EndsWith('/')) continue;
                    var dest = Path.GetFullPath(Path.Combine(stage, e.FullName));
                    if (!dest.StartsWith(stageFull, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("The update contained an unsafe file path, so it was not installed.");
                    var ext = Path.GetExtension(dest).ToLowerInvariant();
                    if (ext is ".exe" or ".dll" or ".bat" or ".cmd" or ".ps1" or ".msi" or ".vbs" or ".lnk") throw new InvalidOperationException("The update contained a program file, which page updates are not allowed to include.");
                    Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                    e.ExtractToFile(dest, overwrite: false);
                }
            }

            // 3. is it what it says it is, and does it fit this program?
            var got = Read(stage) ?? throw new InvalidOperationException("The update is missing required files, so it was not installed.");
            if (got.version != Version.Parse(info.Version)) throw new InvalidOperationException("The update's version did not match its release, so it was not installed.");
            if (got.minHost > Version.Parse(HostVersion)) throw new InvalidOperationException("This update needs a newer version of the program.");

            // 4. swap in, keeping one previous version
            if (Directory.Exists(Previous)) Directory.Delete(Previous, true);
            if (Directory.Exists(Current)) Directory.Move(Current, Previous);
            Directory.Move(stage, Current);
            Paths.Log_($"installed page update {info.Version}");
        }
        finally
        {
            try { if (File.Exists(tmpZip)) File.Delete(tmpZip); } catch { /* temp file only */ }
            try { if (Directory.Exists(stage)) Directory.Delete(stage, true); } catch { /* left-over staging only */ }
        }
    }

    // ---------- program updates (the installer) ----------
    const long MaxInstaller = 150L * 1024 * 1024;

    /// <summary>
    /// Checks a downloaded installer before it is ever run: right size, matching SHA-256 from the release manifest, a real Windows program
    /// (starts with "MZ"), and a file version that matches the release. Returns null if it is fine, otherwise a plain reason.
    /// </summary>
    public static string? VerifyInstaller(string path, UpdateInfo info)
    {
        try
        {
            var len = new FileInfo(path).Length;
            if (len < 1024 || len > MaxInstaller) return "The installer has an unexpected size, so it was not run.";
            if (info.InstallerSize > 0 && len != info.InstallerSize) return "The installer is not the size the release says, so it was not run.";
            using var fs = File.OpenRead(path);
            var head = new byte[2]; fs.ReadExactly(head, 0, 2);
            if (head[0] != (byte)'M' || head[1] != (byte)'Z') return "The download is not a Windows program, so it was not run.";
            fs.Position = 0;
            if (!string.Equals(Convert.ToHexString(SHA256.HashData(fs)), info.InstallerSha256, StringComparison.OrdinalIgnoreCase))
                return "The installer did not match its checksum, so it was not run.";
            var fv = System.Diagnostics.FileVersionInfo.GetVersionInfo(path);
            var gotText = $"{fv.FileMajorPart}.{fv.FileMinorPart}.{fv.FileBuildPart}";
            if (!Version.TryParse(info.Version, out var want) || fv.FileMajorPart != want.Major || fv.FileMinorPart != want.Minor || fv.FileBuildPart != want.Build)
                return "The installer's version (" + gotText + ") is not the release's (" + info.Version + "), so it was not run.";
            return null;
        }
        catch (Exception ex) { return "The installer could not be checked (" + ex.GetType().Name + "), so it was not run."; }
    }

    /// <summary>Downloads the release's installer into the update folder and verifies it. Throws with a plain message (and deletes the file) if anything is wrong.</summary>
    public static async Task<string> DownloadInstallerAsync(UpdateInfo info, CancellationToken ct = default)
    {
        if (!info.HasInstaller) throw new InvalidOperationException("This release has no installer attached. Download the latest Dialed from the releases page.");
        Directory.CreateDirectory(Root);
        var path = Path.Combine(Root, "Dialed-Setup-" + info.Version + ".exe");
        try
        {
            using var http = NewClient();
            http.Timeout = TimeSpan.FromMinutes(10);
            using var resp = await GetAsync(http, new Uri(info.InstallerUrl), ct);
            if (resp.Content.Headers.ContentLength > MaxInstaller) throw new InvalidOperationException("The installer is larger than expected, so it was not downloaded.");
            await using (var src = await resp.Content.ReadAsStreamAsync(ct))
            await using (var dst = File.Create(path))
            {
                var buf = new byte[81920]; long total = 0; int n;
                while ((n = await src.ReadAsync(buf, ct)) > 0)
                {
                    total += n;
                    if (total > MaxInstaller) throw new InvalidOperationException("The installer is larger than expected, so it was not downloaded.");
                    await dst.WriteAsync(buf.AsMemory(0, n), ct);
                }
            }
            var bad = VerifyInstaller(path, info);
            if (bad != null) throw new InvalidOperationException(bad);
            return path;
        }
        catch { try { if (File.Exists(path)) File.Delete(path); } catch { /* nothing more to do */ } throw; }
    }

    /// <summary>
    /// Starts the verified installer quietly (a small progress window, no questions). The caller must then close Dialed: the installer replaces its files
    /// and, because of /RELAUNCH=1, opens the new Dialed when it finishes.
    /// </summary>
    public static void LaunchInstaller(string path)
    {
        var psi = new System.Diagnostics.ProcessStartInfo(path, "/SILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS /RELAUNCH=1") { UseShellExecute = true, WorkingDirectory = Root };
        System.Diagnostics.Process.Start(psi);
        Paths.Log_("started the installer " + Path.GetFileName(path));
    }

    /// <summary>Removes installers left by earlier program updates (they are only needed for the moment of installing).</summary>
    public static void CleanInstallers()
    {
        try { foreach (var f in Directory.GetFiles(Root, "Dialed-Setup-*.exe")) { try { File.Delete(f); } catch { /* still in use: next time */ } } } catch { /* no folder yet */ }
    }

    /// <summary>Goes back one version: to the previous download if there is one, otherwise to the version that came with the program.</summary>
    public static bool Revert()
    {
        try
        {
            if (Directory.Exists(Previous) && Read(Previous) != null)
            {
                var swap = Path.Combine(Root, "swap-" + Guid.NewGuid().ToString("N"));
                Directory.Move(Current, swap); Directory.Move(Previous, Current); Directory.Delete(swap, true);
                return true;
            }
            if (Directory.Exists(Current)) { Directory.Delete(Current, true); return true; }
            return false;
        }
        catch (Exception ex) { Paths.Log_("revert failed: " + ex.Message); return false; }
    }
}
