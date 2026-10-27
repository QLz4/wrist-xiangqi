"""Render seven upside-down glyphs; the native image retains normal hit/layout bounds."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'src' / 'common'
scale = 4
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 25 * scale)
for kind, glyph in enumerate('将士象马车炮卒', 1):
    image = Image.new('RGBA', (28 * scale, 28 * scale))
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = draw.textbbox((0, 0), glyph, font=font)
    draw.text(((image.width-right-left)/2, (image.height-bottom-top)/2), glyph,
              font=font, fill='#182728')
    image = image.transpose(Image.Transpose.ROTATE_180).resize((28, 28), Image.Resampling.LANCZOS)
    assert image.getbbox() is not None
    image.save(root / f'black-{kind}.png', optimize=True)
print('Generated seven pre-rotated black glyphs (28x28 RGBA).')
