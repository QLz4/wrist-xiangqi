"""Resize supplied author images and verify payment QR contents stay identical.

Requires Pillow and zxing-cpp. No payment links are opened or requested.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--qr-runtime', type=Path)
args = parser.parse_args()
if args.qr_runtime:
    sys.path.insert(0, str(args.qr_runtime))
import zxingcpp

root = Path(__file__).resolve().parents[1]
out = root / 'src/common'
avatar = ImageOps.exif_transpose(Image.open(args.source/'qlz4头像.jpg')).convert('RGB')
ImageOps.fit(avatar, (144, 144), method=Image.Resampling.LANCZOS).save(out/'author-avatar.png', optimize=True)
report = {}
for channel, name in [('wechat', '微信收款码.jpg'), ('alipay', '支付宝收款码.jpg')]:
    original = ImageOps.exif_transpose(Image.open(args.source/name)).convert('RGB')
    code = zxingcpp.read_barcode(original)
    assert code and code.valid, f'Cannot decode {channel} source'
    modules = 17 + 4 * int(code.extra['Version'])
    scale = 294 // (modules + 8)
    assert scale >= 4
    p = code.position
    # Extract only the code, preserving the supplied centre picture. Use integer
    # pixels per module and a four-module white quiet zone on every side.
    quad = tuple(v for pt in [p.top_left, p.bottom_left, p.bottom_right, p.top_right] for v in (pt.x, pt.y))
    inner = original.transform((modules*scale, modules*scale), Image.Transform.QUAD, quad, Image.Resampling.NEAREST)
    result = Image.new('RGB', (294, 294), 'white')
    offset = (294 - inner.width) // 2
    result.paste(inner, (offset, offset))
    target = out/f'support-{channel}.png'
    result.save(target, optimize=True)
    verified = zxingcpp.read_barcode(Image.open(target))
    assert verified and verified.bytes == code.bytes, f'QR content changed: {channel}'
    report[channel] = {'size': [294, 294], 'modules': modules, 'pixelsPerModule': scale,
                       'payloadMatchesSource': True, 'payloadSha256': hashlib.sha256(code.bytes).hexdigest()}
    print(f'{channel}: 294x294, source and output QR contents match')
(root/'evidence/author-qr-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
