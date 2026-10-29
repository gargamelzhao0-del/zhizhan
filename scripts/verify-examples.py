"""Compile and execute portable C++17 teaching examples; never claims Linux coverage."""
import hashlib
import json
import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'content/examples/cpp'
OUTPUT = ROOT / 'build/course-labs'
OUTPUT.mkdir(parents=True, exist_ok=True)
CXX = os.environ.get('CXX', 'g++')
compiler = shutil.which(CXX)
if not compiler:
    raise SystemExit('A C++17 compiler is required: set CXX or add g++ to PATH.')
FLAGS = ['-std=c++17', '-O2', '-DNDEBUG', '-Wall', '-Wextra', '-Werror', '-pedantic', '-pthread']
report = {'platform': platform.platform(), 'compiler': subprocess.check_output([compiler, '--version'], text=True).splitlines()[0],
          'flags': FLAGS, 'sources': [], 'checks': [], 'linuxExamplesExecuted': False}

def run(args, stdout=None, code=0, stderr=None, timeout=10, input=None):
    result = subprocess.run([str(x) for x in args], input=input, capture_output=True, text=True, timeout=timeout, cwd=OUTPUT)
    assert result.returncode == code, (args, result.returncode, result.stdout, result.stderr)
    if stdout is not None:
        assert result.stdout == stdout, (args, result.stdout, stdout)
    if stderr is not None:
        assert result.stderr == stderr, (args, result.stderr, stderr)
    return result

executables = {}
try:
    for source in sorted(SOURCE.glob('*.cpp')):
        target = OUTPUT / (source.stem + ('.exe' if os.name == 'nt' else ''))
        run([compiler, *FLAGS, source, '-o', target], timeout=60)
        executables[source.name[:2]] = target
        report['sources'].append({'file': source.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
    def check(name, key, args, output, code=0, error=None):
        run([executables[key], *args], output, code, error)
        report['checks'].append(name)
    check('lifetime ownership output', '01', [], 'sensor-7\nsensor\nsensor-7\n')
    (OUTPUT / 'three.bin').write_bytes(b'abc')
    (OUTPUT / 'empty.bin').write_bytes(b'')
    check('RAII exact bytes', '02', ['three.bin'], 'bytes=3\n')
    check('RAII empty file', '02', ['empty.bin'], 'bytes=0\n')
    check('RAII missing file', '02', ['does-not-exist.fixture'], '', 2, 'open failed\n')
    check('vector size capacity index and bounds', '03', [], 'size=0 capacity_at_least_4=1\nsaved_value=20\nsize=3 last=0\nbounds checked\n')
    for iteration in range(100):
        run([executables['04']], 'sum=21 closed_push=0 drained_pop=0\nempty_close=ok\n')
    report['checks'].append('queue close/drain/empty shutdown: 100 runs, each bounded by 10 s')
    for value, expected, code in [('', 'syntax', 2), ('0', 'value=0', 0), ('128', 'value=128', 0),
                                  ('007', 'value=7', 0), ('abc', 'syntax', 2), ('+1', 'syntax', 2),
                                  (' 1', 'syntax', 2), ('1 ', 'syntax', 2), ('12x', 'syntax', 2),
                                  ('-1', 'range', 3), ('129', 'range', 3),
                                  ('999999999999999999999', 'range', 3), ('999999999999999999999x', 'syntax', 2)]:
        check(f'parse {value!r}', '05', [value], expected + '\n', code)
    check('capacity and timer boundaries with NDEBUG', '06', [], 'checks=5 failures=0\n')
    mutant = (SOURCE / '06-testing.cpp').read_text().replace(
        'used <= capacity && added <= capacity - used', 'used + added <= capacity')
    mutant_source = OUTPUT / 'capacity-mutant.cpp'
    mutant_source.write_text(mutant)
    mutant_exe = OUTPUT / ('capacity-mutant.exe' if os.name == 'nt' else 'capacity-mutant')
    run([compiler, *FLAGS, mutant_source, '-o', mutant_exe], timeout=60)
    run([mutant_exe], 'checks=5 failures=1\n', 1, 'FAIL addition overflow\n')
    report['checks'].append('intentional overflow defect detected')
    for label, data, output in [
        ('empty', '', 'accepted=0 rejected=0 sum=0\n'),
        ('blank record', '\n', 'accepted=0 rejected=1 sum=0\n'),
        ('mixed', '0\n7\n128\nabc\n129\n', 'accepted=3 rejected=2 sum=135\n'),
        ('last record no LF', '128', 'accepted=1 rejected=0 sum=128\n'),
        ('CRLF', '0\r\n007\r\n128\r\n', 'accepted=3 rejected=0 sum=135\n'),
        ('invalid syntax', ' 1\n+1\n-1\n1x\n', 'accepted=0 rejected=4 sum=0\n'),
        ('64 byte boundary', '0' * 64 + '\n', 'accepted=1 rejected=0 sum=0\n'),
        ('overlong resync', '0' * 65 + '\n7\n', 'accepted=1 rejected=1 sum=7\n'),
        ('queue backpressure', '1\n' * 10000, 'accepted=10000 rejected=0 sum=10000\n'),
    ]:
        run([executables['07']], output, input=data)
        report['checks'].append('integrated project: ' + label)
    run([executables['07']], '', code=2, stderr='record limit exceeded\n', input='x\n' * 1000001, timeout=30)
    report['checks'].append('integrated project: record limit never reports partial success')
    check('unique ownership move borrow and weak expiration', '08', [], 'source_empty=1 value=42\nborrow_after_move=42\ndestination_empty=1 answer=43\nobserved=9\nexpired=1\n')
    check('stable algorithm identity ordering and wide sum', '09', [], 'kept=3 sum=51 ids=2,3,4\nmissing=1\n')
    check('interface failure preserves output and virtual destruction', '10', [], 'accepted=3 sum=6\nrejected_preserves=1\ndestroyed=2\n')
    check('integer operation and overflow without output corruption', '12', [], 'integer=2 floating=2.5\nadd=1 value=42\noverflow=0 unchanged=42\n')
    check('optional zero and reference failure guarantee', '13', [], 'found=1 value=0\nempty=0\nreject=0 value=95\naccept=1 value=90\n')
    check('value copy owns independent storage', '14', [], 'sensor original=1 copy=2\nborrowed_last=9\n')
    check('generic integer constraints and inverted bounds', '15', [], 'bounded=10 unsigned=7\ninverted=rejected\n')
    for value, output, code in [('443','port=443',0),('1','port=1',0),('65535','port=65535',0),('00080','port=80',0),('0','range',3),('65536','range',3),('12x','syntax',2),('','syntax',2),('9'*100,'range',3),('9'*100+'x','syntax',2)]:
        check('typed error result '+repr(value), '16', [value], output+'\n', code)
    for _ in range(50): run([executables['17']], 'published=42\n')
    report['checks'].append('one-shot acquire/release publication: 50 bounded runs')
    with tempfile.TemporaryDirectory(prefix='zhizhan-course-') as parent:
        target=Path(parent)/'new-lab'
        check('versioned file exact readback', '18', [target], 'bytes=8 value=42\n')
        assert (target/'sample.bin').read_bytes() == bytes.fromhex('4b5630310000002a')
        report['checks'].append('independent binary layout check')
        check('file experiment refuses existing directory', '18', [target], '', 2, 'new directory required\n')
    report['passed'] = True
finally:
    report.setdefault('passed', False)
    (ROOT / 'docs/examples-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': report['passed'], 'compiled': len(report['sources']), 'checks': len(report['checks']), 'linuxExamplesExecuted': False}))
