"""P04 real loopback HTTP + persistent SQLite gateway. Sensor input is caller-provided.
Development adapter: production authentication/TLS, device driver and service deployment are separate boundaries.
"""
import argparse,hashlib,json,math,sqlite3,tempfile,threading,urllib.request
from contextlib import closing
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
def ingest(path,record):
    fields={"session","seq","time_s","unit","value"}
    if set(record)!=fields or not isinstance(record['session'],str) or not record['session'] or type(record['seq']) is not int or record['seq']<0 or record['unit']!='C':raise ValueError("schema")
    if any(type(record[k]) not in (int,float) or not math.isfinite(record[k]) for k in ('time_s','value')) or record['time_s']<0:raise ValueError("nonfinite/range")
    payload=json.dumps(record,sort_keys=True,separators=(',',':'))
    digest=hashlib.sha256(payload.encode()).hexdigest()
    with closing(sqlite3.connect(path)) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS samples(session TEXT,seq INTEGER,time_s REAL,value REAL,digest TEXT,PRIMARY KEY(session,seq))")
        old=db.execute("SELECT digest FROM samples WHERE session=? AND seq=?",(record['session'],record['seq'])).fetchone()
        if old:
            if old[0]!=digest:raise ValueError("conflicting duplicate")
            return "duplicate"
        db.execute("INSERT INTO samples VALUES(?,?,?,?,?)",(record['session'],record['seq'],record['time_s'],record['value'],digest))
    return "inserted"
def handler(path):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def reply(self,status,body):
            data=json.dumps(body).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        def do_GET(self):self.reply(200,{"status":"ready","schema":1}) if self.path=='/health' else self.reply(404,{"error":"path"})
        def do_POST(self):
            try:
                n=int(self.headers.get('Content-Length','0'))
                if self.path!='/sample' or not 0<n<=4096:raise ValueError('path/size')
                record=json.loads(self.rfile.read(n));self.reply(200,{"result":ingest(path,record)})
            except (ValueError,TypeError,KeyError):self.reply(400,{"error":"invalid sample"})
    return Handler
def self_test():
    with tempfile.TemporaryDirectory() as t:
        path=Path(t)/'gateway.db';server=ThreadingHTTPServer(('127.0.0.1',0),handler(path))
        task=threading.Thread(target=server.serve_forever,daemon=True);task.start()
        try:
            url=f'http://127.0.0.1:{server.server_port}'
            assert json.load(urllib.request.urlopen(url+'/health',timeout=2))['schema']==1
            sample={'session':'s1','seq':1,'time_s':0.1,'unit':'C','value':25.0}
            for result in ['inserted','duplicate']:
                request=urllib.request.Request(url+'/sample',data=json.dumps(sample).encode(),headers={'Content-Type':'application/json'})
                assert json.load(urllib.request.urlopen(request,timeout=2))['result']==result
            assert ingest(path,dict(sample,seq=0,time_s=0.0))=='inserted' # out-of-order arrival is retained
            try:ingest(path,dict(sample,value=99))
            except ValueError:pass
            else:raise AssertionError('conflicting duplicate')
            with closing(sqlite3.connect(path)) as db:assert db.execute('SELECT COUNT(*) FROM samples').fetchone()[0]==2
        finally:server.shutdown();server.server_close();task.join()
    print('P04 HTTP/schema/idempotency/conflict/persistence: RESULT: PASS')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--serve',action='store_true');p.add_argument('--db',default='gateway.db');p.add_argument('--port',type=int,default=8790);args=p.parse_args()
    if args.serve:ThreadingHTTPServer(('127.0.0.1',args.port),handler(args.db)).serve_forever()
    else:self_test()
