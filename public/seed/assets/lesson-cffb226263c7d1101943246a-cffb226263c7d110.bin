"""P03 actual Ed25519 + persisted A/B state machine; storage is a SQLite reference model.
Demonstration keys are generated in memory. MCU flash atomicity and hardware trust anchors are separate tests.
"""
import hashlib,json,sqlite3,tempfile
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.exceptions import InvalidSignature
def manifest(version,payload):return json.dumps({"version":version,"sha256":hashlib.sha256(payload).hexdigest()},sort_keys=True,separators=(",",":")).encode()
class Device:
    def __init__(self,path,public_key):
        self.db=sqlite3.connect(path);self.key=public_key
        self.db.execute("CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,active TEXT,version INTEGER,pending TEXT,pending_version INTEGER)")
        self.db.execute("INSERT OR IGNORE INTO state VALUES(1,'A',1,NULL,NULL)");self.db.commit()
    def stage(self,version,payload,signature):
        self.key.verify(signature,manifest(version,payload))
        _,confirmed,pending,_=self.status()
        if pending is not None or version<=confirmed:raise ValueError("pending update or rollback")
        target='B' if self.status()[0]=='A' else 'A'
        with self.db:self.db.execute("UPDATE state SET pending=?,pending_version=? WHERE id=1",(target,version))
    def status(self):return self.db.execute("SELECT active,version,pending,pending_version FROM state WHERE id=1").fetchone()
    def boot(self,health_ok):
        active,version,pending,pv=self.status()
        with self.db:
            if pending is not None and health_ok:self.db.execute("UPDATE state SET active=?,version=?,pending=NULL,pending_version=NULL WHERE id=1",(pending,pv))
            else:self.db.execute("UPDATE state SET pending=NULL,pending_version=NULL WHERE id=1")
        return self.status()
    def close(self):self.db.close()
def self_test():
    key=Ed25519PrivateKey.generate();payload=b"demo firmware v2"
    sig=key.sign(manifest(2,payload))
    with tempfile.TemporaryDirectory() as t:
        path=Path(t)/"device.db";d=Device(path,key.public_key())
        for bad in (payload+b"x",b""):
            try:d.stage(2,bad,sig)
            except InvalidSignature:pass
            else:raise AssertionError("tamper accepted")
        d.stage(2,payload,sig);d.close() # simulated reset after staging
        d=Device(path,key.public_key());assert d.boot(False)[:2]==('A',1)
        d.stage(2,payload,sig);assert d.boot(True)[:2]==('B',2)
        try:d.stage(1,b"old",key.sign(manifest(1,b"old")))
        except ValueError:pass
        else:raise AssertionError("rollback accepted")
        d.close()
    print("P03 Ed25519/tamper/restart/health-failure/confirm/rollback: RESULT: PASS")
if __name__=="__main__":self_test()
