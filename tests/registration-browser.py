"""Run the built Next app against synthetic local WP responses and verify its mobile guest workflow.

Requires a completed Next build, Python Playwright, and Chromium. It sends no email
and never contacts WordPress, Stripe, or any public host. Use --node for Node 22
and optionally --chrome to select an installed Chromium browser.
"""
import argparse, json, os, socket, threading, subprocess, tempfile, time, urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--node',default='node')
parser.add_argument('--chrome')
arguments=parser.parse_args()
from playwright.sync_api import sync_playwright
repo=Path(__file__).resolve().parents[1]
node=arguments.node
scratch=tempfile.TemporaryDirectory(prefix='villa-registration-ui-')
root=Path(scratch.name)
def free_port():
 with socket.socket() as candidate:
  candidate.bind(('127.0.0.1',0)); return candidate.getsockname()[1]
next_port=free_port()
normal='vc_'+'a'*64
exception='vc_'+'b'*64
state={'saved':False,'withdrawn':False,'uploads':0,'deletions':0,'agreement':False,'case':False}
case={'active':True,'expiresAt':'2099-10-15T12:00:00Z','reason':'Synthetic arrival registration exception','travelerName':'Synthetic Adult','hasCopies':False,'caseId':'synthetic-ui-case'}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def output(self,data,status=200):
  body=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_GET(self):
  token=self.path.rsplit('/',1)[-1]
  data={'bookingId':42,'guestName':'Synthetic Adult','guestEmail':'guest@example.invalid','checkInDate':'2026-10-15','checkOutDate':'2026-10-22','status':'confirmed'}
  if token==exception:data['copyException']={**case,'active':not state['withdrawn'],'hasCopies':state['saved']}
  self.output(data)
 def do_POST(self):
  body=self.rfile.read(int(self.headers.get('Content-Length','0')))
  if self.path.endswith('/upload-documents'):
   assert exception.encode() in body
   state['agreement']=b'name="copyAgreement"\r\n\r\ntrue' in body
   state['case']=b'name="copyCaseId"\r\n\r\nsynthetic-ui-case' in body
   state['uploads']+=1;state['saved']=True;self.output({'success':True,'storedCount':1,'bookingId':42})
  else:
   data=json.loads(body);assert data=={'uploadToken':exception,'copyCaseId':'synthetic-ui-case'}
   count=int(state['saved']);state['saved']=False;state['withdrawn']=True;state['deletions']+=count
   self.output({'success':True,'withdrawn':True,'deletedCount':count})
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
env={**os.environ,'WORDPRESS_API_URL':f'http://127.0.0.1:{server.server_port}/wp-json/villa-claudia/v1','WORDPRESS_API_KEY':'synthetic-only-key','NEXT_PUBLIC_BASE_URL':'https://documents.invalid','EMAIL_HOST':'','EMAIL_PASSWORD':'','EMAIL_USER':''}
log=(root/'exception-next.log').open('w',encoding='utf-8')
process=subprocess.Popen([str(node),str(repo/'node_modules/next/dist/bin/next'),'start','-p',str(next_port)],cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
checks=0
try:
 for _ in range(80):
  try:urllib.request.urlopen(f'http://127.0.0.1:{next_port}',timeout=1);break
  except Exception:time.sleep(.25)
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(**({'executable_path':arguments.chrome} if arguments.chrome else {}),headless=True)
  page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{next_port}/uploads/'+normal);page.get_by_role('heading',name='Guest registration',exact=True).wait_for()
  assert page.locator('input[type=file]').count()==0;checks+=1
  assert page.get_by_text('No advance identity-document copy is required.',exact=False).count()==1;checks+=1
  page.goto(f'http://127.0.0.1:{next_port}/uploads/'+exception)
  name=page.get_by_label('Adult guest',exact=True);name.wait_for();assert name.input_value()=='Synthetic Adult' and name.get_attribute('readonly') is not None;checks+=1
  assert page.locator('input[type=file]').count()==1 and page.get_by_role('button',name='Add Another Guest').count()==0;checks+=1
  assert page.get_by_label('Document number',exact=True).count()==0;checks+=1
  button=page.get_by_role('button',name='Submit my optional copy');assert button.is_disabled();checks+=1
  page.locator('input[type=file]').set_input_files({'name':'synthetic.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\nSYNTHETIC NO PERSONAL DATA'})
  page.get_by_role('checkbox').check();assert button.is_enabled();checks+=1
  button.click();page.get_by_role('button',name='Withdraw agreement and delete my copy').wait_for()
  assert state['uploads']==1 and state['agreement'] and state['case'];checks+=1
  assert page.get_by_text('you do not need to upload again',exact=False).count()==1;checks+=1
  page.get_by_role('button',name='Withdraw agreement and delete my copy').click()
  page.get_by_text('The exception is closed and its copies have been deleted.',exact=False).wait_for()
  assert state['deletions']==1 and not state['saved'];checks+=1
  assert page.locator('input[type=file]').count()==0;checks+=1
  page.reload();assert page.locator('input[type=file]').count()==0;checks+=1
  page.goto(f'http://127.0.0.1:{next_port}/uploads/'+exception);assert page.locator('input[type=file]').count()==0;checks+=1
  assert not errors,errors;checks+=1
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');checks+=1
  canonical=json.loads((repo/'content/privacy-policy.json').read_text(encoding='utf-8'))
  for language,path in [('en','/privacy'),('de','/privacy/de')]:
   page.goto(f'http://127.0.0.1:{next_port}'+path)
   page.get_by_role('heading',name=canonical['languages'][language]['title'],exact=True).wait_for()
   assert page.locator('article').get_attribute('lang')==language;checks+=1
   assert page.locator('#villa-privacy-policy-'+language).evaluate('(el, html) => { const expected = document.createElement("div"); expected.innerHTML = html; return el.textContent === expected.textContent; }',canonical['languages'][language]['html']);checks+=1
   assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth');checks+=1
  assert not errors,errors;checks+=1
  browser.close()
 print(json.dumps({'checks':checks,'passed':checks,'scope':'Hydrated mobile UI, synthetic WP, actual Next routes, optional agreement/single copy/upload/withdrawal/default guidance and bilingual policy text parity','uploads':state['uploads'],'deletedCopies':state['deletions'],'pageErrors':len(errors)}))
finally:
 process.terminate()
 try:process.wait(timeout=10)
 except subprocess.TimeoutExpired:process.kill();process.wait()
 server.shutdown();server.server_close();log.close();scratch.cleanup()
