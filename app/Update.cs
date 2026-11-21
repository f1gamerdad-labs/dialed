using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;

namespace TunerApp;

sealed record UpdateInfo(string Version, string[] Notes, string ContentUrl, string Sha256, string MinHost, long Size);

/// <summary>
/// In-app updates for the part of the app that changes most: the page, the design, and the settings tables.
/// It only ever talks to the project's GitHub releases over HTTPS, checks every download against a SHA-256 in the
/// release's manifest, refuses anything unsafe, and keeps the previous version so an update can be undone.
/// </summary>
static class UpdateService
{
    /// <summary>The program itself. It changes only for the rarer updates that need a new download.</summary>
    public const string HostVersion = "0.5.0";
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
        using var doc = JsonDocument.Parse(text);
        var r = doc.RootElement;
        var info = new UpdateInfo(
            r.GetProperty("version").GetString()!, r.TryGetProperty("notes", out var n) ? n.EnumerateArray().Select(x => x.GetString() ?? "").Take(12).ToArray() : Array.Empty<string>(),
            r.GetProperty("contentUrl").GetString()!, r.GetProperty("sha256").GetString()!.ToLowerInvariant(),
            r.TryGetProperty("minHost", out var m) ? m.GetString()! : "0.0.0", r.TryGetProperty("size", out var s) ? s.GetInt64() : 0);
        return Version.Parse(info.Version) > Version.Parse(CurrentVersion()) ? info : null;
    }

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
