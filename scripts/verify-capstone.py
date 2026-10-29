"""Build and test the multi-file C++17 course project; target OS is explicit."""
from pathlib import Path
import hashlib, json, os, platform, shutil, subprocess, tempfile
ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT/'content/examples/cpp/project'
BUILD = ROOT/'build/course-capstone'
BUILD.mkdir(parents=True, exist_ok=True)
cmake = shutil.which('cmake') or 'C:/Espressif/tools/cmake/4.0.3/bin/cmake.exe'
ninja = shutil.which('ninja') or 'C:/Espressif/tools/ninja/1.12.1/ninja.exe'
compiler = shutil.which('g++')
if not compiler: raise SystemExit('C++ compiler is required')
def run(args, code=0, expected=None):
    result = subprocess.run([str(a) for a in args], capture_output=True, text=True, timeout=60)
    if result.returncode != code or (expected is not None and result.stdout != expected):
        raise RuntimeError(f'{args}: exit={result.returncode}, stdout={result.stdout!r}, stderr={result.stderr!r}')
    return result
run([cmake,'-S',SOURCE,'-B',BUILD,'-G','Ninja',f'-DCMAKE_MAKE_PROGRAM={ninja}',f'-DCMAKE_CXX_COMPILER={compiler}','-DCMAKE_BUILD_TYPE=Release'])
run([cmake,'--build',BUILD])
ctest = Path(cmake).with_name('ctest.exe' if os.name=='nt' else 'ctest')
run([ctest,'--test-dir',BUILD,'--output-on-failure'])
exe = BUILD/('sample_audit.exe' if os.name=='nt' else 'sample_audit')
core = BUILD/('test_record.exe' if os.name=='nt' else 'test_record')
run([core],expected='checks=11 failures=0\n')
checks=[]
with tempfile.TemporaryDirectory(prefix='zhizhan-project-') as temp:
    directory=Path(temp)
    for name,data,expected in [
        ('empty',b'','accepted=0 rejected=0 sum=0\n'),
        ('mixed',b'0\n7\n128\nabc\n129\n','accepted=3 rejected=2 sum=135\n'),
        ('long',b'0'*65+b'\n7\n','accepted=1 rejected=1 sum=7\n'),
        ('unicode','你好\n42'.encode(),'accepted=1 rejected=1 sum=42\n'),
    ]:
        path=directory/(name+'.txt');path.write_bytes(data)
        run([exe,path],expected=expected);checks.append(name)
    run([exe],code=2,expected='');checks.append('usage')
    run([exe,directory/'missing.txt'],code=3,expected='');checks.append('missing')
report={'passed':True,'platform':platform.platform(),'cmakeTests':2,'coreAssertions':11,'cliChecks':checks,
        'sources':[{'file':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SOURCE.iterdir()) if p.is_file()]}
(ROOT/'docs/capstone-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='sources'},ensure_ascii=False))
