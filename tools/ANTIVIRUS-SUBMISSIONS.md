# Antivirus false-positive routine (for Sean, per release)

Dialed is unsigned and asks for administrator rights to measure frame rate, so some antivirus products flag it. Do this after each full release
(installer or zip). Page-only updates are not executables, so they don't need it.

1. **Get the checksums.** Every release has `SHA256SUMS.txt` and the same list in its notes (the publish script adds them).
2. **Microsoft Defender (do this first, most Windows PCs use it).** Submit `Dialed-Setup.exe` and `Dialed-win-x64.zip` at
   https://www.microsoft.com/en-us/wdsi/filesubmission as "Software developer", choose "I believe this file is clean", and give: the release URL, the
   GitHub repo, "open source frame-time tool using Intel PresentMon, requires administrator to read ETW frame events". You need a Microsoft account.
3. **Other products people report.** When someone says which antivirus blocks it, submit the same file to that vendor's false-positive form
   (Avast/AVG, Norton, McAfee, Kaspersky, Bitdefender and ESET all have one). Keep a note of what was submitted below.
4. **Check VirusTotal** (virustotal.com) for the installer after publishing. A couple of low-reputation detections is normal for an unsigned
   program; if the number grows, submit those vendors.
5. **If it keeps happening:** the proper fix is code signing (a certificate costs money and needs identity checks). Revisit when downloads grow.

## Submission log
| Date | Release | Vendor | File | Result |
|---|---|---|---|---|
| | | | | |
