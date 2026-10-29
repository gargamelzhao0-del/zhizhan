"""P06 persistent data + model promotion ledger; messaging uses direct adapter calls.
Broker transport and real fleet rollout need separate integration tests.
"""
import json,sqlite3,tempfile
from contextlib import closing
from pathlib import Path
from p04_gateway import ingest
def promote(db_path,name,passed,expected_active):
    with closing(sqlite3.connect(db_path)) as db, db:
        db.execute('CREATE TABLE IF NOT EXISTS model_state(id INTEGER PRIMARY KEY,name TEXT)')
        db.execute("INSERT OR IGNORE INTO model_state VALUES(1,'baseline')")
        db.execute('CREATE TABLE IF NOT EXISTS releases(name TEXT,passed INTEGER,result TEXT)')
        active=db.execute('SELECT name FROM model_state WHERE id=1').fetchone()[0]
        result='promoted' if passed and active==expected_active else 'rejected'
        if result=='promoted':db.execute('UPDATE model_state SET name=? WHERE id=1',(name,))
        db.execute('INSERT INTO releases VALUES(?,?,?)',(name,int(passed),result))
    return result
def self_test():
    with tempfile.TemporaryDirectory() as t:
        db=Path(t)/'loop.db'
        base={'session':'s1','seq':1,'time_s':.1,'unit':'C','value':25}
        assert ingest(db,base)=='inserted' and ingest(db,base)=='duplicate'
        assert ingest(db,dict(base,seq=0,time_s=0))=='inserted'
        assert promote(db,'v2',False,'baseline')=='rejected'
        assert promote(db,'v2',True,'baseline')=='promoted'
        assert promote(db,'stale',True,'baseline')=='rejected'
        assert promote(db,'baseline',True,'v2')=='promoted' # explicit model rollback policy
        with closing(sqlite3.connect(db)) as c:
            assert [r[0] for r in c.execute('SELECT seq FROM samples ORDER BY session,seq')]==[0,1]
            assert c.execute('SELECT COUNT(*) FROM releases').fetchone()[0]==4
    print('P06 duplicate/order/failed-eval/stale-promotion/rollback/audit: RESULT: PASS')
if __name__=='__main__':self_test()
