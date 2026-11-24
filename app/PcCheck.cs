using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace TunerApp;

/// <summary>PC check: gathers plain facts about this PC (memory speed, power plan, display refresh, graphics card link and so on) using only what
/// Windows itself reports: WMI, the registry, powercfg and, when an NVIDIA driver is installed, nvidia-smi. No drivers are loaded and nothing is changed.
/// The page (pc-check.js) turns these facts into findings. Every fact is read on its own, so one failure leaves the rest intact; failures are listed in "errors".</summary>
static class PcCheck
{
    public static Dictionary<string, object?> Collect()
    {
        var f = new Dictionary<string, object?>();
        var errors = new List<string>();
        void Try(string name, Action a) { try { a(); } catch (Exception ex) { errors.Add(name + ": " + ex.GetType().Name + " " + ex.Message); Paths.Log_("pc check: " + name + " failed: " + ex.Message); } }

        Try("memory", () =>
        {
            var ram = new List<object>();
            foreach (var m in Wmi("SELECT Capacity, Speed, ConfiguredClockSpeed, SMBIOSMemoryType, PartNumber, DeviceLocator, Manufacturer FROM Win32_PhysicalMemory"))
                ram.Add(new { capGB = (int)Math.Round(U(m, "Capacity") / 1073741824.0), rated = (int)U(m, "Speed"), configured = (int)U(m, "ConfiguredClockSpeed"), type = (int)U(m, "SMBIOSMemoryType"),
                    part = (S(m, "PartNumber") ?? "").Trim(), locator = S(m, "DeviceLocator") ?? "", maker = (S(m, "Manufacturer") ?? "").Trim() });
            f["ram"] = ram;
            long slots = 0; foreach (var a in Wmi("SELECT MemoryDevices FROM Win32_PhysicalMemoryArray")) slots += (long)U(a, "MemoryDevices");
            f["ramSlots"] = slots;
        });
        Try("cpu", () =>
        {
            foreach (var c in Wmi("SELECT Name, NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor"))
            { f["cpu"] = new { name = (S(c, "Name") ?? "").Trim(), cores = (int)U(c, "NumberOfCores"), threads = (int)U(c, "NumberOfLogicalProcessors") }; break; }
        });
        Try("graphics", () =>
        {
            var gpus = new List<object>();
            foreach (var g in Wmi("SELECT Name, DriverVersion, DriverDate FROM Win32_VideoController"))
            {
                var date = g["DriverDate"] is string ds && ds.Length >= 8 ? $"{ds[..4]}-{ds.Substring(4, 2)}-{ds.Substring(6, 2)}" : null;
                gpus.Add(new { name = (S(g, "Name") ?? "").Trim(), driver = S(g, "DriverVersion"), date });
            }
            f["gpus"] = gpus;
        });
        Try("displays", () => f["displays"] = Displays.Scan());
        Try("power plan", () => f["power"] = PowerPlan());
        Try("windows gaming settings", () =>
        {
            f["gameMode"] = RegInt(Registry.CurrentUser, @"Software\Microsoft\GameBar", "AutoGameModeEnabled");
            f["hags"] = RegInt(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Control\GraphicsDrivers", "HwSchMode");
            f["gameDvr"] = RegInt(Registry.CurrentUser, @"System\GameConfigStore", "GameDVR_Enabled");
            f["appCapture"] = RegInt(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\GameDVR", "AppCaptureEnabled");
            f["hvci"] = RegInt(Registry.LocalMachine, @"SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity", "Enabled");
            // "Record what happened": the setting that actually records in the background. AppCaptureEnabled / GameDVR_Enabled only mean the feature is allowed, and are on by default.
            f["historicalCapture"] = RegInt(Registry.CurrentUser, @"Software\Microsoft\Windows\CurrentVersion\GameDVR", "HistoricalCaptureEnabled");
        });
        Try("virtualisation security", () =>
        {
            foreach (var d in Wmi("SELECT VirtualizationBasedSecurityStatus, SecurityServicesRunning FROM Win32_DeviceGuard", @"root\Microsoft\Windows\DeviceGuard"))
            {
                f["vbs"] = (int)U(d, "VirtualizationBasedSecurityStatus");   // virtualisation-based security is running (it can run without Memory integrity)
                if (d["SecurityServicesRunning"] is Array running) f["hvciRunning"] = running.Cast<object>().Any(x => Convert.ToInt32(x) == 2);   // service 2 = Memory integrity (HVCI) is actually running
                break;
            }
        });
        Try("windows", () =>
        {
            foreach (var o in Wmi("SELECT Caption, BuildNumber FROM Win32_OperatingSystem"))
            { f["os"] = new { caption = (S(o, "Caption") ?? "").Trim(), build = int.TryParse(S(o, "BuildNumber"), out var b) ? b : 0 }; break; }
        });
        Try("storage", () =>
        {
            var disks = new List<object>();
            foreach (var d in Wmi("SELECT FriendlyName, MediaType, BusType, Size FROM MSFT_PhysicalDisk", @"root\Microsoft\Windows\Storage"))
            {
                var media = (int)U(d, "MediaType"); var bus = (int)U(d, "BusType");
                disks.Add(new { name = (S(d, "FriendlyName") ?? "").Trim(), media = media == 4 ? "SSD" : media == 3 ? "HDD" : "Unknown", bus = bus == 17 ? "NVMe" : bus == 7 ? "USB" : bus == 11 ? "SATA" : "Other", gb = (int)Math.Round(U(d, "Size") / 1073741824.0) });
            }
            f["disks"] = disks;
        });
        Try("nvidia", () => f["nvidia"] = Nvidia());
        Try("running programs", () => f["busy"] = Busy.Running());   // the same list the capture warns about: browsers, OBS, Discord and the like
        f["errors"] = errors;
        return f;
    }

    /// <summary>Refresh rate of the main (primary) screen in Hz, or 0 if Windows does not say. Used as Dialed's default frame rate target.</summary>
    public static int PrimaryRefresh() { try { return Displays.PrimaryHz(); } catch { return 0; } }

    // ---------- helpers ----------
    static IEnumerable<ManagementObject> Wmi(string query, string scope = @"root\cimv2")
    {
        using var s = new ManagementObjectSearcher(scope, query);
        foreach (ManagementObject o in s.Get()) yield return o;
    }
    static string? S(ManagementBaseObject o, string p) => o[p]?.ToString();
    static double U(ManagementBaseObject o, string p) => o[p] == null ? 0 : Convert.ToDouble(o[p]);
    static int? RegInt(RegistryKey root, string path, string name)
    {
        using var k = root.OpenSubKey(path); var v = k?.GetValue(name);
        return v is int i ? i : null;
    }

    static object? PowerPlan()
    {
        var o = RunTool("powercfg", "/getactivescheme", 4000);
        if (o == null) return null;
        var i = o.IndexOf(':'); var rest = i >= 0 ? o[(i + 1)..].Trim() : o.Trim();
        var open = rest.IndexOf('('); var guid = (open > 0 ? rest[..open] : rest).Trim();
        var name = open > 0 ? rest[(open + 1)..].TrimEnd(')', ' ', '\r', '\n') : "";
        // Windows 11's "Power mode" (Best performance / Balanced / Best power efficiency) is an overlay on top of the plan powercfg reports, so it is read separately.
        string? overlay = null;
        try { overlay = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes")?.GetValue("ActiveOverlayAcPowerScheme") as string; } catch { /* not there on older Windows */ }
        return new { guid, name, overlay };
    }

    /// <summary>nvidia-smi ships with the NVIDIA driver. Missing (AMD or Intel graphics) means null, not an error.</summary>
    static object? Nvidia()
    {
        var exe = new[] { Path.Combine(Environment.SystemDirectory, "nvidia-smi.exe"), @"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe" }.FirstOrDefault(File.Exists);
        if (exe == null) return null;
        var line = RunTool(exe, "--query-gpu=name,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max,clocks.gr,clocks.max.gr,utilization.gpu --format=csv,noheader,nounits", 5000)?.Split('\n').FirstOrDefault();
        if (string.IsNullOrWhiteSpace(line)) return null;
        var p = line.Split(',').Select(x => x.Trim()).ToArray();
        if (p.Length < 8) return null;
        int I(string s) => int.TryParse(s, out var v) ? v : 0;
        bool? rebar = null;
        var mem = RunTool(exe, "-q -d MEMORY", 5000);
        if (mem != null)
        {
            long Find(string section) { var idx = mem.IndexOf(section, StringComparison.Ordinal); if (idx < 0) return 0; var m = System.Text.RegularExpressions.Regex.Match(mem[idx..], @"Total\s*:\s*(\d+)\s*MiB"); return m.Success ? long.Parse(m.Groups[1].Value) : 0; }
            long fb = Find("FB Memory Usage"), bar = Find("BAR1 Memory Usage");
            if (fb > 0 && bar > 0) rebar = bar >= fb * 0.9;   // a small BAR1 window (256 MiB) means Resizable BAR is off
        }
        return new { name = p[0], pcieGen = I(p[1]), pcieGenMax = I(p[2]), pcieWidth = I(p[3]), pcieWidthMax = I(p[4]), clockMHz = I(p[5]), clockMaxMHz = I(p[6]), utilPct = I(p[7]), rebar };
    }

    static string? RunTool(string file, string args, int timeoutMs)
    {
        var psi = new ProcessStartInfo(file, args) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };
        using var p = Process.Start(psi); if (p == null) return null;
        var outTask = p.StandardOutput.ReadToEndAsync(); _ = p.StandardError.ReadToEndAsync();   // both pipes are drained, so a chatty tool can never block
        if (!p.WaitForExit(timeoutMs)) { try { p.Kill(true); } catch { } return null; }
        return p.ExitCode == 0 ? outTask.Result : null;
    }

    /// <summary>Every monitor Windows has attached: the adapter driving it, its current refresh rate and the highest the monitor offers at that size.</summary>
    static class Displays
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        struct DEVMODE
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
            public ushort dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra; public uint dmFields; public int dmPositionX, dmPositionY; public uint dmDisplayOrientation, dmDisplayFixedOutput;
            public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
            public ushort dmLogPixels; public uint dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency, dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
        }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        struct DISPLAY_DEVICE
        {
            public uint cb; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
            public uint StateFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceID; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
        }
        [DllImport("user32.dll", CharSet = CharSet.Ansi)] static extern bool EnumDisplayDevices(string? dev, uint n, ref DISPLAY_DEVICE d, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Ansi)] static extern bool EnumDisplaySettings(string dev, int mode, ref DEVMODE m);

        static readonly Dictionary<string, string> MakerNames = new()
        {
            ["AOC"] = "AOC", ["GSM"] = "LG", ["SAM"] = "Samsung", ["DEL"] = "Dell", ["ACI"] = "ASUS", ["AUS"] = "ASUS", ["BNQ"] = "BenQ", ["MSI"] = "MSI", ["GBT"] = "Gigabyte",
            ["LEN"] = "Lenovo", ["HWP"] = "HP", ["PHL"] = "Philips", ["ACR"] = "Acer", ["VSC"] = "ViewSonic", ["NEC"] = "NEC", ["IVM"] = "iiyama", ["EIZ"] = "EIZO", ["XMI"] = "Xiaomi"
        };

        /// <summary>Real monitor model names, keyed by the part of the hardware id Windows shares between the two lists, e.g. "AOCB305\5&amp;2670e056&amp;0&amp;UID4352".</summary>
        static Dictionary<string, string> ModelNames()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                using var s = new ManagementObjectSearcher(@"root\wmi", "SELECT InstanceName, UserFriendlyName, ManufacturerName FROM WmiMonitorID");
                foreach (ManagementObject o in s.Get())
                {
                    var inst = o["InstanceName"]?.ToString() ?? ""; if (inst.StartsWith("DISPLAY\\", StringComparison.OrdinalIgnoreCase)) inst = inst[8..];
                    if (inst.EndsWith("_0")) inst = inst[..^2];
                    string Text(string prop) { var c = o[prop] as ushort[] ?? (o[prop] as object[])?.Select(Convert.ToUInt16).ToArray() ?? Array.Empty<ushort>(); return new string(c.Where(x => x != 0).Select(x => (char)x).ToArray()).Trim(); }
                    var name = Text("UserFriendlyName"); var maker = Text("ManufacturerName");
                    // Windows often gives only the model ("Q32G3WG3R3"), so put the maker in front, spelling out the common three-letter codes.
                    if (name.Length > 0 && maker.Length > 0)
                    {
                        var brand = MakerNames.TryGetValue(maker.ToUpperInvariant(), out var b) ? b : maker;
                        if (name.StartsWith(maker, StringComparison.OrdinalIgnoreCase)) name = name[maker.Length..].TrimStart(' ', '-');
                        if (!name.StartsWith(brand, StringComparison.OrdinalIgnoreCase)) name = brand + " " + name;
                    }
                    if (inst.Length > 0 && name.Length > 0) map[inst] = name;
                }
            }
            catch { /* names are a nicety; the check still works without them */ }
            return map;
        }

        public static int PrimaryHz()
        {
            for (uint i = 0; ; i++)
            {
                var d = new DISPLAY_DEVICE { cb = (uint)Marshal.SizeOf<DISPLAY_DEVICE>() };
                if (!EnumDisplayDevices(null, i, ref d, 0)) return 0;
                if ((d.StateFlags & 1) == 0 || (d.StateFlags & 4) == 0) continue;   // attached, and the primary one
                var cur = new DEVMODE { dmSize = (ushort)Marshal.SizeOf<DEVMODE>() };
                return EnumDisplaySettings(d.DeviceName, -1, ref cur) ? (int)cur.dmDisplayFrequency : 0;
            }
        }

        public static List<object> Scan()
        {
            var res = new List<object>();
            var names = ModelNames();
            for (uint i = 0; ; i++)
            {
                var d = new DISPLAY_DEVICE { cb = (uint)Marshal.SizeOf<DISPLAY_DEVICE>() };
                if (!EnumDisplayDevices(null, i, ref d, 0)) break;
                if ((d.StateFlags & 1) == 0) continue;            // not attached to the desktop
                string? model = null;
                var mon = new DISPLAY_DEVICE { cb = (uint)Marshal.SizeOf<DISPLAY_DEVICE>() };
                if (EnumDisplayDevices(d.DeviceName, 0, ref mon, 1))   // 1 = give the monitor's interface path, which holds its hardware id
                {
                    var id = mon.DeviceID ?? ""; var a = id.IndexOf("DISPLAY#", StringComparison.OrdinalIgnoreCase); var b = id.LastIndexOf("#{", StringComparison.Ordinal);
                    if (a >= 0 && b > a) names.TryGetValue(id[(a + 8)..b].Replace('#', '\\'), out model);
                }
                var cur = new DEVMODE { dmSize = (ushort)Marshal.SizeOf<DEVMODE>() };
                if (!EnumDisplaySettings(d.DeviceName, -1, ref cur)) continue;
                uint max = 0;
                for (int j = 0; ; j++)
                {
                    var m = new DEVMODE { dmSize = (ushort)Marshal.SizeOf<DEVMODE>() };
                    if (!EnumDisplaySettings(d.DeviceName, j, ref m)) break;
                    if (m.dmPelsWidth == cur.dmPelsWidth && m.dmPelsHeight == cur.dmPelsHeight && m.dmDisplayFrequency > max) max = m.dmDisplayFrequency;
                }
                res.Add(new { name = d.DeviceName.TrimStart('\\', '.'), monitor = model, x = cur.dmPositionX, primary = (d.StateFlags & 4) != 0, adapter = d.DeviceString, width = (int)cur.dmPelsWidth, height = (int)cur.dmPelsHeight, hz = (int)cur.dmDisplayFrequency, maxHz = (int)max });
            }
            return res;
        }
    }
}
