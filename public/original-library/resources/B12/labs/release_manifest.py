"""Hash a declared release set and verify tamper/missing-file detection.
This is a release inventory, NOT a signed attestation or a standards-compliant SBOM.
For authenticity bind its hash to the P03 signature process and an external trust key.
"""
import argparse,hashlib,json,tempfile
from pathlib import Path
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def resolve(root,name):
    path=(root/name).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError('file missing or outside release root: '+name)
    return path
def create(root,names,revision):
    if not revision or not names or len(names)!=len(set(names)):
        raise ValueError('revision and unique declared files required')
    return {'format':'course-release-inventory-v1','revision':revision,
            'files':[{'path':n,'sha256':digest(resolve(root,n))} for n in sorted(names)],
            'scope':'integrity inventory only; dependency/license SBOM and trusted signature separate'}
def verify(root,doc):
    if doc.get('format')!='course-release-inventory-v1' or not doc.get('files'):
        raise ValueError('invalid inventory')
    seen=set()
    for item in doc['files']:
        name=item['path']
        if name in seen:raise ValueError('duplicate file')
        seen.add(name)
        if digest(resolve(root,name))!=item['sha256']:raise ValueError('hash mismatch: '+name)
def self_test():
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);p=root/'firmware.bin';p.write_bytes(b'firmware')
        lock=root/'requirements.txt';lock.write_text('example==1.0\n')
        doc=create(root,['firmware.bin','requirements.txt'],'test-revision')
        verify(root,doc)
        for action in ('tamper','missing'):
            if action=='tamper':p.write_bytes(b'changed')
            else:p.unlink()
            try:verify(root,doc)
            except ValueError:pass
            else:raise AssertionError(action+' not detected')
        try:resolve(root,'../outside')
        except ValueError:pass
        else:raise AssertionError('path escaped')
    print('release inventory: declared files / tamper / missing / path boundary PASS')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['test','create','verify'])
    p.add_argument('--root',type=Path,default=Path('.'));p.add_argument('--manifest',type=Path)
    p.add_argument('--file',action='append',default=[]);p.add_argument('--revision')
    a=p.parse_args()
    if a.action=='test':self_test()
    elif a.manifest is None:p.error('--manifest required')
    elif a.action=='create':
        doc=create(a.root,a.file,a.revision)
        if a.manifest.resolve() in [resolve(a.root,n) for n in a.file]:raise ValueError('manifest cannot hash itself')
        a.manifest.write_text(json.dumps(doc,indent=2)+'\n',encoding='utf-8')
    else:verify(a.root,json.loads(a.manifest.read_text(encoding='utf-8')));print('integrity PASS; authenticity not evaluated')
