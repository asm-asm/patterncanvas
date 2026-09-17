"""Capture unmodified Release UI on real Apple simulators, not browser mockups."""
import json, subprocess, time, pathlib, os

def run(*args):
    return subprocess.check_output(args, text=True).strip()

devices=json.loads(run('xcrun','simctl','list','devices','available','-j'))['devices']
all_devices=[d for runtime in sorted(devices,reverse=True) for d in devices[runtime]]
phone=next(d for d in all_devices if 'iPhone' in d['name'] and 'Pro Max' in d['name'])
pad=next(d for d in all_devices if 'iPad Pro 13' in d['name'])
out=pathlib.Path('native-verification');out.mkdir(exist_ok=True)
manifest={'sourceCommit':os.environ.get('GITHUB_SHA'),'xcode':run('xcodebuild','-version'),'screenshots':[]}
for label,device in [('iphone',phone),('ipad',pad)]:
    uid=device['udid']
    subprocess.run(['xcrun','simctl','boot',uid],check=False)
    run('xcrun','simctl','bootstatus',uid,'-b')
    run('xcrun','simctl','status_bar',uid,'override','--time','9:41','--batteryState','charged','--batteryLevel','100')
    run('xcrun','simctl','install',uid,'ios/App/DerivedData/Build/Products/Release-iphonesimulator/App.app')
    run('xcrun','simctl','launch',uid,'jp.amimononote.ios','-AppleLanguages','(ja)','-AppleLocale','ja_JP')
    time.sleep(12)
    filename=label+'-store.png'
    run('xcrun','simctl','io',uid,'screenshot',str(out/filename))
    manifest['screenshots'].append({'file':filename,'device':device['name']})
    run('xcrun','simctl','shutdown',uid)
(out/'capture.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
