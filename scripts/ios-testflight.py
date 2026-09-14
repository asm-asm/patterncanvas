"""Run only on an isolated macOS runner. Never prints or uploads signing material."""
import base64
import datetime
import os
from pathlib import Path
import plistlib
import re
import secrets
import shutil
import subprocess
import tempfile

BUNDLE = "jp.amimononote.ios"


def run(*args, private=False):
    result = subprocess.run(args, capture_output=private, check=False)
    if result.returncode:
        # security output may contain certificate details; keep it out of public logs.
        raise RuntimeError(f"{Path(args[0]).name} failed (exit {result.returncode})")
    return result.stdout


def main():
    required = ["ASC_PRIVATE_KEY", "ASC_KEY_ID", "ASC_ISSUER_ID", "APPLE_TEAM_ID",
                "IOS_CERTIFICATE_BASE64", "IOS_CERTIFICATE_PASSWORD", "IOS_PROFILE_BASE64"]
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise RuntimeError("Missing GitHub Secrets: " + ", ".join(missing))
    team = os.environ["APPLE_TEAM_ID"]
    key_id = os.environ["ASC_KEY_ID"]
    issuer = os.environ["ASC_ISSUER_ID"]
    assert re.fullmatch(r"[A-Z0-9]{10}", team), "Invalid Team ID"
    assert re.fullmatch(r"[A-Z0-9]{10}", key_id), "Invalid Key ID"
    assert re.fullmatch(r"[0-9a-fA-F-]{36}", issuer), "Invalid Issuer ID"
    os.umask(0o077)
    temp = Path(tempfile.mkdtemp(prefix="amimono-signing-", dir=os.environ["RUNNER_TEMP"]))
    keychain = temp / "signing.keychain-db"
    installed = None
    try:
        p12 = temp / "distribution.p12"
        p12.write_bytes(base64.b64decode(os.environ["IOS_CERTIFICATE_BASE64"], validate=True))
        profile_path = temp / "app.mobileprovision"
        profile_path.write_bytes(base64.b64decode(os.environ["IOS_PROFILE_BASE64"], validate=True))
        profile = plistlib.loads(run("security", "cms", "-D", "-i", str(profile_path), private=True))
        assert team in profile["TeamIdentifier"], "Profile Team ID mismatch"
        assert profile["Entitlements"]["application-identifier"].endswith("." + BUNDLE), "Profile Bundle ID mismatch"
        assert not profile["Entitlements"].get("get-task-allow", False), "Distribution profile required"
        assert "ProvisionedDevices" not in profile and not profile.get("ProvisionsAllDevices"), "App Store profile required"
        assert profile["ExpirationDate"] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None), "Expired profile"
        uuid = profile["UUID"]
        assert re.fullmatch(r"[0-9a-fA-F-]{36}", uuid), "Invalid profile UUID"
        password = secrets.token_urlsafe(32)
        run("security", "create-keychain", "-p", password, str(keychain), private=True)
        run("security", "set-keychain-settings", "-lut", "21600", str(keychain), private=True)
        run("security", "unlock-keychain", "-p", password, str(keychain), private=True)
        run("security", "import", str(p12), "-P", os.environ["IOS_CERTIFICATE_PASSWORD"], "-A", "-t", "cert", "-f", "pkcs12", "-k", str(keychain), private=True)
        run("security", "set-key-partition-list", "-S", "apple-tool:,apple:", "-k", password, str(keychain), private=True)
        run("security", "list-keychains", "-d", "user", "-s", str(keychain), private=True)
        profile_dir = Path.home() / "Library/Developer/Xcode/UserData/Provisioning Profiles"
        profile_dir.mkdir(parents=True, exist_ok=True)
        installed = profile_dir / f"{uuid}.mobileprovision"
        shutil.copyfile(profile_path, installed)
        key_dir = temp / "private_keys"
        key_dir.mkdir()
        (key_dir / f"AuthKey_{key_id}.p8").write_text(os.environ["ASC_PRIVATE_KEY"], encoding="utf-8")
        archive = temp / "App.xcarchive"
        output = Path("ios-distribution").resolve()
        output.mkdir(exist_ok=True)
        build_number = f"{int(os.environ['GITHUB_RUN_NUMBER']) + 10}.{int(os.environ['GITHUB_RUN_ATTEMPT'])}"
        run("xcodebuild", "-project", "ios/App/App.xcodeproj", "-scheme", "App", "-configuration", "Release",
            "-destination", "generic/platform=iOS", "-archivePath", str(archive), "archive",
            f"DEVELOPMENT_TEAM={team}", "CODE_SIGN_STYLE=Manual", "CODE_SIGN_IDENTITY=Apple Distribution",
            f"PROVISIONING_PROFILE_SPECIFIER={uuid}", f"CURRENT_PROJECT_VERSION={build_number}")
        options = temp / "ExportOptions.plist"
        options.write_bytes(plistlib.dumps({"method": "app-store-connect", "destination": "export",
            "teamID": team, "signingStyle": "manual", "signingCertificate": "Apple Distribution",
            "provisioningProfiles": {BUNDLE: uuid}, "manageAppVersionAndBuildNumber": False, "uploadSymbols": True}))
        run("xcodebuild", "-exportArchive", "-archivePath", str(archive), "-exportOptionsPlist", str(options), "-exportPath", str(output))
        ipas = list(output.glob("*.ipa"))
        assert len(ipas) == 1, "Expected one signed IPA"
        # altool looks here for the API key. No Apple Account password is used.
        os.environ["API_PRIVATE_KEYS_DIR"] = str(key_dir)
        auth = ("--apiKey", key_id, "--apiIssuer", issuer)
        run("xcrun", "altool", "--validate-app", "-f", str(ipas[0]), "-t", "ios", *auth)
        uploaded = os.environ.get("UPLOAD_TESTFLIGHT") == "true"
        if uploaded:
            run("xcrun", "altool", "--upload-app", "-f", str(ipas[0]), "-t", "ios", *auth)
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as summary:
            summary.write(f"Build {build_number}: signed and validated. Upload requested: {uploaded}.\n\n")
            summary.write("Apple processing and TestFlight availability must be checked separately. No App Review submission or tester invitations were performed.\n")
    finally:
        if keychain.exists():
            subprocess.run(["security", "delete-keychain", str(keychain)], capture_output=True)
        if installed and installed.exists():
            installed.unlink()
        shutil.rmtree(temp)


if __name__ == "__main__":
    main()
