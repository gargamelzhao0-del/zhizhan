"""Package owned project outputs without signing credentials or machine state."""
import hashlib
import json
import re
import subprocess
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RELEASE = ROOT / 'release'
METADATA = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
VERSION = METADATA['version']
TESTS = json.loads((ROOT / 'docs/unit-tests.json').read_text(encoding='utf-8-sig'))
E2E = json.loads((ROOT / 'docs/e2e-tests.json').read_text(encoding='utf-8-sig'))
CONTENT = json.loads((ROOT / 'docs/content-validation.json').read_text(encoding='utf-8-sig'))
EXAMPLES = json.loads((ROOT / 'docs/examples-validation.json').read_text(encoding='utf-8-sig'))
CATALOG = json.loads((ROOT / 'public/seed/catalog.json').read_text(encoding='utf-8-sig'))
READING = json.loads((ROOT / 'docs/reading-audit.json').read_text(encoding='utf-8-sig'))
MOBILE = json.loads((ROOT / 'docs/mobile-design-audit.json').read_text(encoding='utf-8-sig'))
CHROME = json.loads((ROOT / 'docs/adaptive-chrome-audit.json').read_text(encoding='utf-8-sig'))
GLASS = json.loads((ROOT / 'docs/glass-optics-audit.json').read_text(encoding='utf-8-sig'))
SURFACES = json.loads((ROOT / 'docs/surface-audit.json').read_text(encoding='utf-8-sig'))
NATIVE = json.loads((ROOT / 'docs/native-update-tests.json').read_text(encoding='utf-8-sig'))
ADVANCED = json.loads((ROOT / 'docs/advanced-labs-validation.json').read_text(encoding='utf-8-sig'))
CAPSTONE = json.loads((ROOT / 'docs/capstone-validation.json').read_text(encoding='utf-8-sig'))
SERVER = json.loads((ROOT / 'docs/private-server-validation.json').read_text(encoding='utf-8-sig'))
REMOTE = json.loads((ROOT / 'docs/remote-service-validation.json').read_text(encoding='utf-8-sig'))
if not TESTS['success'] or TESTS['numFailedTests'] or not E2E['stats']['expected'] or E2E['stats']['unexpected'] or E2E['stats']['flaky']:
    raise RuntimeError('Tests must pass before release packaging')
if CONTENT['issues'] or not EXAMPLES['passed']:
    raise RuntimeError('Content checks and executable lesson examples must pass')
if not NATIVE['passed'] or NATIVE['testsPassed'] < 9:
    raise RuntimeError('Native update policy JVM checks must pass')
if not ADVANCED['passed'] or not ADVANCED['tcpFramingTests']['passed'] or ADVANCED['cmakeTests'] != 3:
    raise RuntimeError('Portable networking and CMake learning checks must pass')
if not CAPSTONE['passed'] or CAPSTONE['coreAssertions'] != 11 or len(CAPSTONE['cliChecks']) != 6 or CAPSTONE['cmakeTests'] != 2:
    raise RuntimeError('The multi-file course project must pass its executable checks')
if not READING['passed'] or READING['contentVersion'] != CATALOG['contentVersion'] or len(READING['pages']) != len(CATALOG['articles']):
    raise RuntimeError('Every bundled article must pass the mobile reading audit')
if not MOBILE['passed'] or MOBILE['version'] != VERSION or len(MOBILE['pages']) < 112:
    raise RuntimeError('Responsive phone layouts must pass the current release audit')
if not CHROME['passed'] or CHROME['version'] != VERSION or len(CHROME['cases']) < 30:
    raise RuntimeError('Adaptive phone navigation must pass the current release audit')
if not GLASS['passed'] or GLASS['version'] != VERSION or not GLASS['refractionChangesRenderedPixels'] or not GLASS['backdropDiffusionChangesRenderedPixels']:
    raise RuntimeError('Glass effects must affect actual rendered pixels, not only computed styles')
if not SURFACES['passed'] or SURFACES['before'] or SURFACES['version'] != VERSION or len(SURFACES['cases']) < 108:
    raise RuntimeError('All primary and secondary surfaces must pass the current release review')

def sha(data):
    return hashlib.sha256(data).hexdigest()

for example in EXAMPLES['sources']:
    if sha((ROOT / example['file']).read_bytes()) != example['sha256']:
        raise RuntimeError('Lesson source changed after executable verification')
for source in NATIVE['sources']:
    if sha((ROOT / source['file']).read_bytes()) != source['sha256']:
        raise RuntimeError('Native update source changed after JVM verification')
for source in ADVANCED['sources']:
    if sha((ROOT / source['file']).read_bytes()) != source['sha256']:
        raise RuntimeError('Advanced lesson source changed after verification')
for source in CAPSTONE['sources']:
    if sha((ROOT / source['file']).read_bytes()) != source['sha256']:
        raise RuntimeError('Capstone source changed after verification')

def write_zip(destination, files, base):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for file in sorted(files):
            archive.write(file, file.relative_to(base).as_posix())

desktop = RELEASE / 'zhizhan-windows'
write_zip(RELEASE / f'zhizhan-{VERSION}-windows.zip', [p for p in desktop.rglob('*') if p.is_file()], RELEASE)

excluded = {'node_modules', 'dist', 'release', '.private', '.git', '.gradle', 'build', 'test-results', 'playwright-report', '.npm-cache'}
source = [p for p in ROOT.rglob('*') if p.is_file() and not any(s in excluded for s in p.relative_to(ROOT).parts)
          and p.name != 'local.properties' and not p.name.endswith(('.log', '.tsbuildinfo'))
          and not (p.relative_to(ROOT).as_posix().startswith('android/app/src/main/assets/'))]
write_zip(RELEASE / f'zhizhan-{VERSION}-source.zip', source, ROOT)

with zipfile.ZipFile(RELEASE / f'zhizhan-{VERSION}-source.zip') as archive:
    if any(any(x in n.lower() for x in ('.private/', '.jks', 'signing.properties', 'local.properties')) for n in archive.namelist()):
        raise RuntimeError('Private material entered source package')

apk = RELEASE / f'zhizhan-{VERSION}-android.apk'
if not SERVER['passed'] or SERVER['version'] != VERSION or SERVER['sha256'] != sha(apk.read_bytes()):
    raise RuntimeError('Private server must deliver the current verified APK')
if not REMOTE['passed'] or not REMOTE['publicHttpsVerified'] or REMOTE['version'] != VERSION or REMOTE['sha256'] != sha(apk.read_bytes()):
    raise RuntimeError('Public authenticated HTTPS must deliver the current verified APK')
apk_metadata = json.loads((ROOT / 'android/app/build/outputs/apk/release/output-metadata.json').read_text(encoding='utf-8'))['elements'][0]
if apk_metadata['versionName'] != VERSION or apk_metadata['versionCode'] != METADATA['androidVersionCode']:
    raise RuntimeError('Android version does not match the release')
with zipfile.ZipFile(apk) as archive:
    apk_catalog = json.loads(archive.read('assets/public/seed/catalog.json'))
    if apk_catalog != CATALOG:
        raise RuntimeError('APK bundled catalog must match the reviewed source catalog')
    for asset in apk_catalog['attachments']:
        if not re.fullmatch(r'assets/(source|lesson)-[a-f0-9]{24}-[a-f0-9]{16}\.bin', asset['path']):
            raise RuntimeError('An APK attachment can fall through to the Android HTML router')
        data = archive.read('assets/public/seed/' + asset['path'])
        if sha(data) != asset['sha256'] or not asset['path'].endswith('-' + sha(data)[:16] + '.bin'):
            raise RuntimeError('APK attachment bytes or content-addressed path failed integrity checks')
    mismatches = []
    for file in (ROOT/'dist').rglob('*'):
        if file.is_file():
            target='assets/public/'+file.relative_to(ROOT/'dist').as_posix()
            if sha(archive.read(target)) != sha(file.read_bytes()):
                mismatches.append(target)
    if mismatches:
        raise RuntimeError(f'APK web assets do not match dist: {mismatches}')

with zipfile.ZipFile(RELEASE/'zhizhan-initial-library.zip') as archive:
    initial=json.loads(archive.read('manifest.json'))
    assert len(initial['articles']) == len(CATALOG['articles']) and len(initial['attachments']) == len(CATALOG['attachments'])
    assert {a['id']:a['body'] for a in initial['articles']} == {a['id']:a['body'] for a in CATALOG['articles']}
    assert not archive.testzip()

outputs=[]
subprocess.run(['node', 'scripts/package-update.mjs'], cwd=ROOT, check=True)
update_directory = RELEASE / f'zhizhan-{VERSION}-update-feed'
feed = json.loads((update_directory/'latest.json').read_text(encoding='utf-8'))
if feed['apk']['sha256'] != sha(apk.read_bytes()) or feed['versionCode'] != METADATA['androidVersionCode']:
    raise RuntimeError('Published feed must match the delivered APK')
write_zip(RELEASE/f'zhizhan-{VERSION}-update-feed.zip', [p for p in update_directory.rglob('*') if p.is_file()], update_directory)
for filename in [f'zhizhan-{VERSION}-android.apk',f'zhizhan-{VERSION}-source.zip',f'zhizhan-{VERSION}-windows.zip',f'zhizhan-{VERSION}-update-feed.zip','zhizhan-initial-library.zip']:
    file = RELEASE / filename
    outputs.append({'file':file.name,'bytes':file.stat().st_size,'sha256':sha(file.read_bytes())})

manifest={'app':'知栈','version':VERSION,'versionCode':METADATA['androidVersionCode'],'date':date.today().isoformat(),'applicationId':'app.zhizhan.local',
          'minimumAndroidApi':26,'targetAndroidApi':36,'minimumWebView':109,
          'certificateSha256':'726ad22d5bf14cf9f282cdee34f9a545fa18cf3759117853ab283f682979256d',
          'apkAssetsMatchDist':True,'articles':len(CATALOG['articles']),'attachments':len(CATALOG['attachments']),'unitTestsPassed':TESTS['numPassedTests'],'browserE2ETestsPassed':E2E['stats']['expected'],
          'contentVersion':CATALOG['contentVersion'],'cppExamplesCompiled':len(EXAMPLES['sources']),'cppChecksPassed':len(EXAMPLES['checks']),
          'portableTcpFramingTestsPassed':ADVANCED['tcpFramingTests']['count'],'cmakeTestsPassed':ADVANCED['cmakeTests'],
          'capstoneCoreAssertionsPassed':CAPSTONE['coreAssertions'],'capstoneCliChecksPassed':len(CAPSTONE['cliChecks']),
          'capstoneCmakeTestsPassed':CAPSTONE['cmakeTests'],'androidBundledAssetRouteContractVerified':True,
          'mobileReadingPagesPassed':len(READING['pages']),
          'responsiveLayoutCasesPassed':len(MOBILE['pages']),
          'adaptiveChromeCasesPassed':len(CHROME['cases']),
          'primaryAndSecondarySurfaceCasesPassed':len(SURFACES['cases']),
          'glassRenderedPixelsVerified':GLASS['passed'],
          'nativeUpdatePolicyJvmTestsPassed':NATIVE['testsPassed'],'updateEndpointConfigured':True,'updateFeedPublished':REMOTE['publicHttpsVerified'],
          'publicAuthenticatedHttpsVerified':REMOTE['passed'],'userReportedInstalledVersion':'1.3.0',
          'privateUpdateLoopbackVerified':SERVER['passed'],'privateUpdateRemotePhoneTested':SERVER['remotePhoneTested'],
          'releaseStatus':'acceptance_candidate','samsungS24InstallationVerified':False,'linuxExamplesExecuted':False,
          'androidDeviceRuntimeTested':False,'sourceFiles':len(source),'artifacts':outputs}
(RELEASE/'release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(RELEASE/'SHA256SUMS.txt').write_text('\n'.join(f"{f['sha256']}  {f['file']}" for f in outputs)+'\n',encoding='utf-8')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
