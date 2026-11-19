using System.Drawing;

namespace TunerApp;

/// <summary>The decisions behind the tray icon and the remembered window position, kept free of any window so they can be tested (see --selftest-features).</summary>
static class TrayRules
{
    /// <summary>Closing the window hides it to the tray only when the user asked for that, only for a normal close click (never a Windows shutdown or a
    /// program close request), and never once Exit was chosen from the tray menu.</summary>
    public static bool HideInsteadOfClose(CloseReason reason, bool trayMode, bool exiting) => reason == CloseReason.UserClosing && trayMode && !exiting;

    /// <summary>A saved window position is only used if enough of it is still on a connected screen (a monitor may have been unplugged or rearranged).</summary>
    public static bool FitsOnAScreen(Rectangle saved, IEnumerable<Rectangle> screens)
    {
        if (saved.Width < 400 || saved.Height < 300) return false;
        foreach (var s in screens)
        {
            var i = Rectangle.Intersect(saved, s);
            if (i.Width >= 200 && i.Height >= 120) return true;
        }
        return false;
    }

    /// <summary>Single-instance names. The first copy owns the mutex and listens on the event; a second copy signals the event and exits.</summary>
    public const string MutexName = @"Local\Dialed-by-F1GamerDad-instance", ShowEventName = @"Local\Dialed-by-F1GamerDad-show";
}
