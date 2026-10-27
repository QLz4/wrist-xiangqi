from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root/'src/manifest.json').read_text(encoding='utf-8'))
version = manifest['versionName']
rpk = root/'dist'/f"{manifest['package']}.debug.{version}.rpk"
with zipfile.ZipFile(rpk) as z:
    assert z.testzip() is None
    compiled = json.loads(z.read('manifest.json'))
    for field in ('package','versionName','versionCode','features','config'):
        assert compiled[field] == manifest[field], field
    for file in ('app.js','pages/index/index.js','common/board.png','common/icon.png','META-INF/CERT'):
        assert file in z.namelist(), file
    for kind in range(1, 8):
        name = f'common/black-{kind}.png'
        assert z.read(name) == (root/'src'/name).read_bytes(), name
    for name in ('author-avatar.png', 'support-wechat.png', 'support-alipay.png'):
        assert z.read('common/'+name) == (root/'src/common'/name).read_bytes(), name
    assert 'transformOrigin' not in z.read('pages/index/index.js').decode('utf-8')
digest = hashlib.sha256(rpk.read_bytes()).hexdigest()
(root/'dist'/f'SHA256SUMS-{version}.txt').write_text(f'{digest}  {rpk.name}\n',encoding='utf-8')
archive = root/'dist'/f'wrist-xiangqi-{version}-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for folder in ('src','tests','tools','preview','evidence'):
        for file in (root/folder).rglob('*'):
            if file.is_file():
                z.write(file,file.relative_to(root).as_posix())
    for name in ('package.json','package-lock.json','.gitignore','README.md','验收记录.md','CHANGELOG.md'):
        z.write(root/name,name)
print(f'RPK verified: {rpk.name}, {rpk.stat().st_size} bytes')
print(f'SHA256: {digest}')
print(f'Source: {archive.name}, {archive.stat().st_size} bytes')
