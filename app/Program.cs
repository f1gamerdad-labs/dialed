namespace TunerApp;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // Anything that goes wrong is written to the log (Report a problem includes it), and the app tells the user instead of vanishing.
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, e) => { Paths.Log_("UNHANDLED (ui): " + e.Exception); Tell(e.Exception); };
        AppDomain.CurrentDomain.UnhandledException += (_, e) => Paths.Log_("UNHANDLED (fatal): " + e.ExceptionObject);
        TaskScheduler.UnobservedTaskException += (_, e) => { Paths.Log_("UNHANDLED (task): " + e.Exception); e.SetObserved(); };
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new MainForm(args));
    }

    static bool told;
    static void Tell(Exception ex)
    {
        if (told) return; // one message per run is enough; the rest go to the log
        told = true;
        MessageBox.Show("Dialed hit a problem and wrote it to its log.\n\n" + ex.Message +
            "\n\nYou can keep using it. If it keeps happening, open Report a problem and send it to F1GamerDad.",
            "Dialed by F1GamerDad", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}
