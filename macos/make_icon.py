"""Render the application's BMW/arrow identity at all macOS icon sizes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
root = Path(__file__).resolve().parent
size = 1024
image = Image.new('RGBA', (size, size))
shadow = Image.new('RGBA', image.size)
draw = ImageDraw.Draw(shadow)
draw.rounded_rectangle((75, 88, 949, 970), 196, fill=(0, 12, 36, 90))
image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
mask = Image.new('L', image.size)
ImageDraw.Draw(mask).rounded_rectangle((64, 64, 960, 960), 196, fill=255)
gradient = Image.new('RGBA', image.size)
pixels = gradient.load()
for y in range(size):
    for x in range(size):
        glow = max(0, 1 - ((x-840)**2 + (y-160)**2)**.5 / 1100)
        pixels[x, y] = (int(10+16*glow), int(25+48*glow), int(46+88*glow), 255)
gradient.putalpha(mask)
image.alpha_composite(gradient)
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((65, 65, 959, 959), 195, outline=(109, 160, 215, 100), width=3)
font = ImageFont.truetype(str(root.parent/'fonts/NotoSans-Bold.ttf'), 250)
label = 'BMW'
bounds = draw.textbbox((0, 0), label, font=font)
draw.text(((size - (bounds[2] - bounds[0])) / 2 - bounds[0], 575 - (bounds[1] + bounds[3]) / 2), label, font=font, fill=(242, 247, 255))
# Import / movement arrow, echoing the sidebar identity.
draw.line([(602, 440), (794, 248)], fill=(90, 186, 255), width=48)
draw.line([(657, 246), (797, 246), (797, 386)], fill=(90, 186, 255), width=48, joint='curve')
for x, color in [(651, (100,190,247)), (711, (47,110,232)), (771, (229,240,255))]:
    draw.polygon([(x,778),(x+38,778),(x+2,876),(x-36,876)], fill=color)
image.save(root/'AppIcon.png')
image.save(root/'AppIcon.icns', format='ICNS')
icons = root/'AppIcon.iconset'; icons.mkdir(exist_ok=True)
for n in (16, 32, 128, 256, 512):
    for scale in (1,2):
        suffix = '@2x' if scale==2 else ''
        image.resize((n*scale,n*scale),Image.Resampling.LANCZOS).save(icons/f'icon_{n}x{n}{suffix}.png')
