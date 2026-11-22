; Dialed installer (Inno Setup 6). Build it with tools\make-installer.ps1 after the package folder release\Dialed-win-x64 exists.
; It installs Dialed like any other program: Program Files, a Start menu entry, an optional desktop shortcut and an entry in "Installed apps"
; so it can be uninstalled. Installing over an older version upgrades it in place. Your captures, backups, profiles and settings live outside the
; install folder (Documents\Dialed and AppData) and are never touched by installing or uninstalling.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\release\Dialed-win-x64"
#endif

; /DTestInstall builds an installer that cannot touch a real install: another AppId, a throwaway folder and no administrator rights.
; It is only for testing the in-app updater end to end (see test\update-e2e.ps1).
[Setup]
#ifdef TestInstall
AppId={{6A1E6B5C-4C0E-4B7A-9C57-2D3F8A7E10D1}
DefaultDirName={localappdata}\DialedUpdateTest
PrivilegesRequired=lowest
#else
AppId={{CD5D5091-C6D9-413B-90A2-B84E9708BBF5}
DefaultDirName={autopf}\Dialed
; Dialed asks Windows for administrator rights itself (it measures frame rate), so it is installed for all users.
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline
#endif
AppName=Dialed
AppVersion={#AppVersion}
AppVerName=Dialed {#AppVersion}
AppPublisher=F1GamerDad
AppPublisherURL=https://f1gamerdad-labs.github.io/dialed/
AppSupportURL=https://f1gamerdad-labs.github.io/dialed/
DefaultGroupName=Dialed
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\Dialed.exe
SetupIconFile=..\assets\app.ico
OutputDir=..\release
OutputBaseFilename=Dialed-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion={#AppVersion}
VersionInfoCompany=F1GamerDad
VersionInfoDescription=Dialed Setup

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Dialed"; Filename: "{app}\Dialed.exe"
Name: "{group}\Uninstall Dialed"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Dialed"; Filename: "{app}\Dialed.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Dialed.exe"; Description: "Open Dialed now"; Flags: nowait postinstall skipifsilent runascurrentuser
; The in-app updater runs this installer quietly with /RELAUNCH=1 and expects Dialed to reopen when it is done.
Filename: "{app}\Dialed.exe"; Flags: nowait runascurrentuser skipifnotsilent; Check: RelaunchRequested

[Code]
function RelaunchRequested: Boolean;
begin
  Result := ExpandConstant('{param:RELAUNCH|0}') = '1';
end;
