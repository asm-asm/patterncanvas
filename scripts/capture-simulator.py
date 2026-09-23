"""Capture the real native UI on a disposable iOS Simulator; no signing/upload."""
import json, pathlib, subprocess, time, signal
out=pathlib.Path('store-capture');out.mkdir(exist_ok=True)
def run(*args):return subprocess.check_output(args,text=True).strip()
devices=json.loads(run('xcrun','simctl','list','devices','available','--json'))['devices']
choices=[d for ds in devices.values() for d in ds if 'iPhone' in d['name'] and ('Pro Max' in d['name'])]
device=choices[-1];udid=device['udid'];print(device,flush=True)
subprocess.run(['xcrun','simctl','boot',udid],check=False)
run('xcrun','simctl','bootstatus',udid,'-b')
run('xcrun','simctl','status_bar',udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
run('xcrun','simctl','install',udid,'capture-build/Build/Products/Debug-iphonesimulator/App.app')
bundle='jp.amimononote.ios'
run('xcrun','simctl','launch',udid,bundle)
container=pathlib.Path(run('xcrun','simctl','get_app_container',udid,bundle,'data'))/'Documents'
def waitfile(name,check=lambda x:True,timeout=80):
 end=time.time()+timeout
 while time.time()<end:
  try:
   data=json.loads((container/name).read_text())
   if check(data):return data
  except (FileNotFoundError,json.JSONDecodeError):pass
  time.sleep(.25)
 raise RuntimeError(f'Timeout {name}; files={list(container.glob("*"))}')
waitfile('capture-ready.json')
seq=0
def command(action,**kw):
 global seq
 seq+=1;data=dict(id=str(seq),action=action,**kw);temp=container/'command.tmp';temp.write_text(json.dumps(data));temp.replace(container/'capture-command.json')
 return waitfile('capture-result.json',lambda x:x['id']==str(seq))
def shot(name):run('xcrun','simctl','io',udid,'screenshot',str(out/(name+'.png')))
command('view',view='both',scroll='#preview-panel');shot('01-both')
command('view',view='chart',scroll='#chart-panel');shot('02-editor')
for kind in ['design','knit','count']:
 if kind=='count':command('lock')
 command('view',view='both' if kind!='count' else 'chart',scroll='.counter' if kind=='knit' else '#chart-panel')
 proc=subprocess.Popen(['xcrun','simctl','io',udid,'recordVideo','--codec=h264',str(out/(kind+'.mov'))])
 time.sleep(1)
 result=command(kind)
 proc.send_signal(signal.SIGINT);proc.wait(timeout=20)
 shot('03-'+kind)
 (out/(kind+'-result.json')).write_text(json.dumps(result,ensure_ascii=False))
command('view',view='preview',scroll='#preview-panel');shot('04-preview')
command('view',view='both',scroll='.counter');shot('05-counter')
command('view',view='settings');shot('06-settings')
(out/'provenance.json').write_text(json.dumps({'device':device,'bundle':bundle,'source':'Native iOS Simulator; original app rendering and controls; local sample project and scripted UI actions only'},indent=2))
