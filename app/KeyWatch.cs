using System.Runtime.InteropServices;

namespace TunerApp;

/// <summary>
/// A second way of hearing the capture hotkey, for games that keep the keyboard to themselves (so Windows' normal hotkey never arrives).
/// It watches for exactly one key combination and nothing else: no other key is looked at, stored or sent anywhere, and every key still reaches
/// the game untouched. The normal hotkey stays as it was; if both hear the same press, the caller ignores the second one.
/// </summary>
sealed class KeyWatch : IDisposable
{
    const int WH_KEYBOARD_LL = 13, WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101, WM_SYSKEYDOWN = 0x0104, WM_SYSKEYUP = 0x0105;
    const int VK_SHIFT = 0x10, VK_CONTROL = 0x11, VK_MENU = 0x12;

    delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr module, uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string? name);

    readonly HookProc proc;   // kept in a field so it is not collected while Windows still holds it
    readonly Action<uint> onPress;   // given the time of the key press (Windows' millisecond clock)
    IntPtr hook = IntPtr.Zero;
    int vk; bool ctrl, shift, alt, isDown;

    public KeyWatch(Action<uint> onPress) { this.onPress = onPress; proc = Callback; }

    public bool Running => hook != IntPtr.Zero;

    /// <summary>Which combination to listen for. A key that is not supported switches the listener off.</summary>
    public void Set(Hotkey h)
    {
        vk = Enum.TryParse<Keys>(h.Key, true, out var k) ? (int)k : 0;
        ctrl = h.Ctrl; shift = h.Shift; alt = h.Alt; isDown = false;
    }

    public bool Start()
    {
        if (hook != IntPtr.Zero) return true;
        hook = SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(null), 0);
        return hook != IntPtr.Zero;
    }

    public void Stop() { if (hook != IntPtr.Zero) { UnhookWindowsHookEx(hook); hook = IntPtr.Zero; } }
    public void Dispose() => Stop();

    static bool Held(int key) => (GetAsyncKeyState(key) & 0x8000) != 0;

    IntPtr Callback(int code, IntPtr wParam, IntPtr lParam)
    {
        try
        {
            if (code >= 0 && vk != 0 && Marshal.ReadInt32(lParam) == vk)   // first field of the hook data is the key code
            {
                int msg = (int)wParam;
                if (msg is WM_KEYDOWN or WM_SYSKEYDOWN)
                {
                    // only the exact combination counts, and holding the key down fires once (like the normal hotkey)
                    if (!isDown && Held(VK_CONTROL) == ctrl && Held(VK_SHIFT) == shift && Held(VK_MENU) == alt) { isDown = true; onPress(unchecked((uint)Marshal.ReadInt32(lParam, 12))); }   // offset 12: the hook data's time stamp
                }
                else if (msg is WM_KEYUP or WM_SYSKEYUP) isDown = false;
            }
        }
        catch { /* never let a problem here get in the way of the keyboard */ }
        return CallNextHookEx(hook, code, wParam, lParam);   // always pass the key on, untouched
    }
}
