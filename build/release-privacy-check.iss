; Also validate release inputs when ISCC is invoked directly.
#ifndef FusionPrivacyGateComplete
#define FusionPrivacyGateComplete
#define PrivacyPython AddBackslash(SourcePath) + "candidate\python3144\python.exe"
#define PrivacyScript AddBackslash(SourcePath) + "release_privacy.py"
#define PrivacyRoot AddBackslash(SourcePath) + "candidate"
#define PrivacyManifest AddBackslash(SourcePath) + "release-manifest.json"
#define PrivacyGateExitCode Exec(PrivacyPython, '-I -S -B -X utf8 "' + PrivacyScript + '" --root "' + PrivacyRoot + '" --manifest "' + PrivacyManifest + '" --quiet', SourcePath, 1)
#if PrivacyGateExitCode != 0
  #error "Release privacy/manifest validation failed. No installer was generated."
#endif
#endif
