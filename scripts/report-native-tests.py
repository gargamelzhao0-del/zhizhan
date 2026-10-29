"""Record an existing successful app JVM test run; this script does not run Android."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
xml = root / 'android/app/build/test-results/testReleaseUnitTest/TEST-app.zhizhan.local.UpdatePolicyTest.xml'
suite = ET.parse(xml).getroot()
if any(int(suite.attrib[key]) for key in ('failures', 'errors', 'skipped')) or int(suite.attrib['tests']) < 7:
    raise RuntimeError('Native policy tests must pass without skips')
sources = [root / 'android/app/src/main/java/app/zhizhan/local/UpdatePolicy.java',
           root / 'android/app/src/main/java/app/zhizhan/local/UpdatesPlugin.java',
           root / 'android/app/src/test/java/app/zhizhan/local/UpdatePolicyTest.java']
if any(source.stat().st_mtime > xml.stat().st_mtime for source in sources):
    raise RuntimeError('Java source changed after JVM tests; rerun :app:testReleaseUnitTest')
report = {'passed': True, 'runner': 'Gradle :app:testReleaseUnitTest / JVM', 'timestamp': suite.attrib['timestamp'],
          'testsPassed': int(suite.attrib['tests']), 'androidRuntimeTested': False,
          'checks': [case.attrib['name'] for case in suite.findall('testcase')],
          'sources': [{'file': source.relative_to(root).as_posix(), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()} for source in sources]}
(root / 'docs/native-update-tests.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'passed': True, 'tests': report['testsPassed'], 'androidRuntimeTested': False}))
