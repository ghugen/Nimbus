"""Gera materiais originais de demonstração; fonte e PDFs versionados no repositório."""
import json,pathlib
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=pathlib.Path(__file__).resolve().parents[1]
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
pdfmetrics.registerFont(TTFont('NimbusBody',FONT));pdfmetrics.registerFont(TTFont('NimbusBold',FONT.replace('Sans.ttf','Sans-Bold.ttf')))
W,H=595.28,841.89
styles={name:ParagraphStyle(name,fontName='NimbusBold' if name in ('title','heading') else 'NimbusBody',fontSize=size,leading=lead,textColor=HexColor('#24212B')) for name,size,lead in [('title',26,33),('heading',12,17),('body',10.5,16),('intro',11,17)]}
def paragraph(c,text,y,style='body'):
 p=Paragraph(text,styles[style]);_,height=p.wrap(W-104,H);p.drawOn(c,52,y-height);return y-height
items=json.loads((ROOT/'scripts/content/demo-guides.json').read_text())
for item in items:
 target=ROOT/'public/materiais-gratuitos'/f"{item['id']}.pdf";c=canvas.Canvas(str(target),pagesize=(W,H));c.setTitle(item['title']);c.setAuthor('Equipe Nimbus');c.setSubject('Material demonstrativo original e gratuito')
 for index,page in enumerate(item['pages'],1):
  c.setFillColor(HexColor('#FAF7F0'));c.rect(0,0,W,H,fill=1,stroke=0)
  c.setFillColor(HexColor('#B9A3F5'));c.rect(0,H-19,W,19,fill=1,stroke=0)
  c.setFillColor(HexColor('#24212B'));c.setFont('NimbusBold',20);c.drawString(52,H-66,'nimbus.')
  c.setFont('NimbusBody',8);c.drawRightString(W-52,H-62,'COLEÇÃO ABERTA / ESTUDO ACADÊMICO')
  y=paragraph(c,page['title'],H-104,'title')-18;y=paragraph(c,page['intro'],y,'intro')-25
  for title,text in page.get('sections',[]):
   y=paragraph(c,title,y,'heading')-7;y=paragraph(c,text,y)-19
  for line in page.get('worksheet',[]):
   y=paragraph(c,line,y)-21
  assert y>85,(item['id'],index,y)
  c.setStrokeColor(HexColor('#24212B'));c.line(52,64,W-52,64)
  c.setFont('NimbusBody',7);c.drawString(52,48,'Material original demonstrativo • Uso pessoal e educacional • Nimbus / 2026')
  c.drawRightString(W-52,48,f'{index} / {len(item["pages"])}');c.showPage()
 c.save()
print('4 PDFs criados; 3 páginas cada.')
