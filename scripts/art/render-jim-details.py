"""Arrange unretouched Blender model renders as a precise approval proof sheet.

No photograph is substituted for a 3D render. Reproduce the source renders with
build-jim.py for each style, then run this script with Pillow installed.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / 'art/jim/review'
W, H = 2000, 1580
canvas = Image.new('RGB', (W, H), '#ebeee7')
draw = ImageDraw.Draw(canvas)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def text(value, xy, size, bold=False, fill='#2d3e32'):
    draw.text(xy, value, font=ImageFont.truetype(BOLD if bold else FONT, size), fill=fill)

def panel(box, label, title, image_path, caption):
    x, y, w, h = box
    draw.rounded_rectangle((x, y, x+w, y+h), radius=12, fill='#dce2d7', outline='#c4cdbf', width=2)
    text(label, (x+28, y+22), 18, True, '#6b7a62')
    text(title, (x+28, y+52), 30, True)
    image = Image.open(image_path).convert('RGBA')
    # Trim transparent render margins only; preserve every visible model pixel.
    bounds = image.getchannel('A').getbbox()
    image = image.crop(bounds)
    area = (w-56, h-170)
    image = ImageOps.contain(image, area, Image.Resampling.LANCZOS)
    px = x+(w-image.width)//2; py = y+108+(area[1]-image.height)//2
    canvas.paste(image, (px, py), image)
    text(caption, (x+28, y+h-38), 17, fill='#60715b')

text('JIM / FACE & FOOTWEAR', (60, 46), 43, True)
text('Revised 3D assets · Normal and Special styles · Awaiting your approval', (62, 108), 22, fill='#63715c')
panel((60, 166, 840, 1300), 'FACE / BOTH STYLES', 'Rebuilt from your close-up', REVIEW/'normal-face.png', 'Actual model render. Profile and back details are inferred.')
panel((934, 166, 1006, 635), 'NORMAL / SWEATSHIRT', 'Taupe suede clogs', REVIEW/'normal-shoes.png', 'Curved opening, sloping strap, outside buckle and cork footbed.')
panel((934, 831, 1006, 635), 'SPECIAL / GOLF', 'Cream and green sneakers', REVIEW/'golf-shoes.png', 'Layered panels, crossed laces, green side marks and brown tread.')
text('Nothing has been deployed. Use Face and Footwear in the interactive review to inspect and rotate.', (62, 1510), 22, fill='#63715c')
canvas.save(REVIEW/'Jim-Face-and-Footwear.png')
print('Saved approval proof sheet from the actual 3D renders.')
