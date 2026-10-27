from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'src' / 'common'
board = Image.new('RGB', (306,340), '#d8bb86')
d = ImageDraw.Draw(board)
for row in range(10):
    y = 17 + row*34
    d.line((17,y,289,y), fill='#846b44', width=1)
for col in range(9):
    x = 17+col*34
    if col in (0,8): d.line((x,17,x,323), fill='#846b44', width=1)
    else:
        d.line((x,17,x,153), fill='#846b44', width=1)
        d.line((x,187,x,323), fill='#846b44', width=1)
for y in (17,255):
    d.line((119,y,187,y+68),fill='#846b44',width=1)
    d.line((187,y,119,y+68),fill='#846b44',width=1)
river_font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
d.text((94,169),'楚 河',font=river_font,fill='#846b44',anchor='mm')
d.text((212,169),'汉 界',font=river_font,fill='#846b44',anchor='mm')
board.save(root/'board.png', optimize=True)

icon=Image.new('RGB',(192,192),'#121b19'); d=ImageDraw.Draw(icon)
d.rounded_rectangle((14,14,178,178),radius=36,fill='#bd9355')
d.ellipse((32,32,160,160),fill='#f7e4bc',outline='#a52022',width=5)
font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',92)
d.text((96,86),'帅',font=font,fill='#a52022',anchor='mm')
icon.save(root/'icon.png',optimize=True)
