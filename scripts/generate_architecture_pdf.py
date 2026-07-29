#!/usr/bin/env python3
"""
Architecture Technique - Plateforme SaaS RAG pour Generation de Rapports Academiques
ReportLab body PDF generation (cover is separate, merged later)
"""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter

# ─── Paths ───
FONT_DIR = '/usr/share/fonts'
SCRIPT_DIR = '/home/z/my-project/scripts'
DIAGRAMS_DIR = os.path.join(SCRIPT_DIR, 'diagrams')
OUTPUT_BODY = os.path.join(SCRIPT_DIR, 'architecture_body.pdf')
OUTPUT_FINAL = '/home/z/my-project/download/Architecture-Technique-SaaS-RAG.pdf'

# ─── Cascade Palette ───
PAGE_BG       = HexColor('#f2f3f4')
SECTION_BG    = HexColor('#e9ebec')
CARD_BG       = HexColor('#edeff0')
TABLE_STRIPE  = HexColor('#f1f2f2')
HEADER_FILL   = HexColor('#406070')
COVER_BLOCK   = HexColor('#43545c')
BORDER        = HexColor('#b8c2c7')
ICON          = HexColor('#4a829e')
ACCENT        = HexColor('#2f82ab')
ACCENT_2      = HexColor('#c35e6f')
TEXT_PRIMARY   = HexColor('#222526')
TEXT_MUTED     = HexColor('#7a8185')
SEM_SUCCESS   = HexColor('#538d67')
SEM_WARNING   = HexColor('#a18141')
SEM_ERROR     = HexColor('#aa5b54')
SEM_INFO      = HexColor('#4d759c')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ─── Font Registration ───
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
# NotoSansSC is a variable font not supported by ReportLab TTFont
# Skip - use FreeSerif for body text (French document)

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
# NotoSansSC is a variable font in this env

registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('NotoSansSC', normal='SarasaMonoSC', bold='SarasaMonoSC')


# ─── Font Fallback ───
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'skills', 'pdf', 'scripts'))
try:
    from pdf import install_font_fallback
    install_font_fallback()
except:
    pass

# ─── Styles ───
A4_W, A4_H = A4
MARGIN_L, MARGIN_R, MARGIN_T, MARGIN_B = 2.2*cm, 2.2*cm, 2.5*cm, 2.5*cm
CONTENT_W = A4_W - MARGIN_L - MARGIN_R

MAX_KEEP_HEIGHT = A4_H * 0.4

# French body style (left-aligned for mixed FR/EN)
body_style = ParagraphStyle(
    name='FRBody', fontName='FreeSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=6, textColor=TEXT_PRIMARY
)

# Heading styles
h1_style = ParagraphStyle(
    name='FRH1', fontName='FreeSerif-Bold', fontSize=20, leading=28,
    spaceBefore=18, spaceAfter=12, textColor=HEADER_FILL
)
h2_style = ParagraphStyle(
    name='FRH2', fontName='FreeSerif-Bold', fontSize=15, leading=22,
    spaceBefore=14, spaceAfter=8, textColor=HexColor('#3a5565')
)
h3_style = ParagraphStyle(
    name='FRH3', fontName='FreeSerif-Bold', fontSize=12.5, leading=18,
    spaceBefore=10, spaceAfter=6, textColor=HexColor('#4a6575')
)

# Code style
code_style = ParagraphStyle(
    name='FRCode', fontName='DejaVuSans', fontSize=8, leading=12,
    alignment=TA_LEFT, spaceAfter=4, textColor=HexColor('#37352f'),
    backColor=HexColor('#f7f7f7'), leftIndent=8, rightIndent=8,
    borderPadding=(4,4,4,4), borderColor=BORDER, borderWidth=0.5
)

# Caption
caption_style = ParagraphStyle(
    name='FRCaption', fontName='FreeSerif-Italic', fontSize=9, leading=14,
    alignment=TA_CENTER, spaceBefore=3, spaceAfter=6, textColor=TEXT_MUTED
)

# Bullet style
bullet_style = ParagraphStyle(
    name='FRBullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    alignment=TA_LEFT, spaceAfter=4, textColor=TEXT_PRIMARY,
    leftIndent=20, bulletIndent=8, bulletFontName='FreeSerif', bulletFontSize=10
)

# TOC styles
toc_h0_style = ParagraphStyle(
    name='TOCH0', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    leftIndent=0, textColor=HEADER_FILL
)
toc_h1_style = ParagraphStyle(
    name='TOCH1', fontName='FreeSerif', fontSize=11, leading=18,
    leftIndent=20, textColor=TEXT_PRIMARY
)

# ─── Helpers ───
def P(text, style=body_style):
    return Paragraph(text, style)

def H1(text):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', h1_style)
    p.bookmark_name = key
    p.bookmark_level = 0
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def H2(text):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', h2_style)
    p.bookmark_name = key
    p.bookmark_level = 1
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def H3(text):
    return Paragraph(f'<b>{text}</b>', h3_style)

def Code(text):
    return Paragraph(text, code_style)

def Bullet(text):
    return Paragraph(text, bullet_style, bulletText='\u2022')

def Caption(text):
    return Paragraph(text, caption_style)

def HR():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def Img(filename, width=CONTENT_W*0.95):
    path = os.path.join(DIAGRAMS_DIR, filename)
    if os.path.exists(path):
        img = Image(path, width=width, height=width*0.55)
        img.hAlign = 'CENTER'
        return img
    return P(f'[Image non disponible: {filename}]')

def safe_keep(elements):
    total_h = 0
    for el in elements:
        w, h = el.wrap(CONTENT_W, A4_H)
        total_h += h
    if total_h <= MAX_KEEP_HEIGHT:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with cascade palette colors."""
    header_row = [Paragraph(f'<b>{h}</b>', ParagraphStyle(
        name='TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=14,
        textColor=TABLE_HEADER_TEXT, alignment=TA_LEFT
    )) for h in headers]
    
    data = [header_row]
    for i, row in enumerate(rows):
        styled_row = []
        for cell in row:
            styled_row.append(Paragraph(str(cell), ParagraphStyle(
                name=f'TC{i}_{hash(cell)}', fontName='FreeSerif', fontSize=9, leading=14,
                textColor=TEXT_PRIMARY, alignment=TA_LEFT
            )))
        data.append(styled_row)
    
    if col_widths is None:
        n = len(headers)
        col_widths = [CONTENT_W / n] * n
    
    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')
    
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), TABLE_HEADER_TEXT),
        ('FONTNAME', (0,0), (-1,0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,1), (-1,-1), 6),
        ('TOPPADDING', (0,1), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [TABLE_ROW_EVEN, TABLE_ROW_ODD]),
    ]
    tbl.setStyle(TableStyle(style_cmds))
    return tbl

# ─── TOC DocTemplate ───
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_page_number(canvas, doc):
    """Add page number footer (skip page 1 = cover)."""
    page_num = canvas.getPageNumber()
    if page_num > 1:
        text = f"{page_num - 1}"
        canvas.saveState()
        canvas.setFont('FreeSerif', 9)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawCentredString(A4_W/2, 1.2*cm, text)
        canvas.restoreState()

# ═══════════════════════════════════════════════════════════════════
# BUILD STORY
# ═══════════════════════════════════════════════════════════════════
story = []

# ── TOC ──
toc = TableOfContents()
toc.levelStyles = [toc_h0_style, toc_h1_style]
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 1: Vue d'ensemble & Stack technique
# ═══════════════════════════════════════════════════════════════════
story.append(H1('1. Vue d\'ensemble et stack technique'))

story.append(H2('1.1 Contexte et objectif du produit'))
story.append(P(
    'Ce document presente l\'architecture technique complete d\'une plateforme SaaS destinee a la generation '
    'automatisee de rapports academiques (PFE et stages). Le coeur du produit repose sur un pipeline RAG '
    '(Retrieval-Augmented Generation) qui utilise un corpus d\'anciens rapports de reference pour generer '
    'des sommaires structures, puis des rapports complets section par section. L\'editeur split-view, '
    'base sur TipTap, permet a l\'utilisateur de selectionner un passage specifique du rapport et de le '
    'modifier via Claude avec une instruction ciblee, le tout dans une interface avant/apres avec diff. '
    'L\'architecture est concue pour une phase test a environ 25 utilisateurs, avec un cout mensuel '
    'quasi nul a 20-40 dollars hors consommation API Claude.'
))
story.append(P(
    'Le flux produit complet suit un parcours en sept etapes : inscription et abonnement via Stripe, '
    'creation de projet avec brief et upload de fichiers, generation du sommaire par RAG, edition '
    'iterative du sommaire par l\'utilisateur, validation du sommaire, generation du rapport complet '
    'en arriere-plan via queue BullMQ, et enfin edition fine dans l\'editeur split-view suivie de '
    'l\'export final en DOCX ou PDF. Chaque etape est detaillee dans les sections suivantes avec '
    'les decisions techniques, le code de reference et les points d\'attention specifiques.'
))

story.append(H2('1.2 Stack technique definitif'))
story.append(P(
    'Le choix de chaque technologie de la stack est motive par une contrainte de vibecoding rapide '
    '(iteration frequente, faible overhead operationnel) et de budget minimal en phase test. '
    'Voici la justification detaillee pour chaque couche de l\'architecture.'
))
story.append(Spacer(1, 12))

stack_headers = ['Couche', 'Technologie', 'Justification']
stack_rows = [
    ['Frontend', 'Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui',
     'SSR + API routes integrees, vibecoding rapide, ecosysteme riche'],
    ['Editeur riche', 'TipTap v2',
     'Selections structurees (nodes, ranges) via ProseMirror, extensible, patch cible'],
    ['Base de donnees', 'PostgreSQL (Neon) + pgvector',
     'RAG natif avec similarity search, RLS pour isolation user, serverless et gratuit en phase test'],
    ['Cache/Queue', 'Upstash Redis + BullMQ',
     'Jobs async pour generation longue (1-3 min), serverless pay-per-use'],
    ['Stockage fichiers', 'Cloudflare R2',
     'S3-compatible, pas d\'egress fees, moins cher que S3 a faible volume'],
    ['Authentification', 'Clerk',
     'Integration rapide, gestion sessions/JWT, UI pre-construite'],
    ['Paiement', 'Stripe Billing',
     'Gestion des tiers, quotas, factures, webhook fiable'],
    ['LLM', 'Anthropic API (Claude Sonnet)',
     'Generation de texte long, edition ciblee, bonne gestion du contexte'],
    ['Embeddings', 'Voyage AI (voyage-3)',
     'Recommande par Anthropic, 1024 dimensions, bon rapport qualite/prix'],
    ['Export DOCX', 'docx (npm)',
     'Generation native Word avec styles academiques (Titre 1/2/3, TOC)'],
    ['Export PDF', 'Puppeteer',
     'Rendu HTML vers PDF fidele pour mise en page academique'],
    ['Hebergement', 'Vercel + Neon + Upstash + R2',
     'Cout quasi nul a 25 users, deploy instantane, scaling automatique'],
    ['Monitoring', 'Sentry + Vercel Analytics',
     'Detection erreurs et perf des le jour 1 de la production'],
]
story.append(make_table(stack_headers, stack_rows, [3.5*cm, 5.5*cm, 8*cm]))
story.append(Caption('Tableau 1 : Stack technique definitif avec justifications'))
story.append(Spacer(1, 12))

story.append(H2('1.3 Architecture systeme'))
story.append(P(
    'L\'architecture suit un modele en couches distinctes : le frontend Next.js gere la UI et les '
    'interactions utilisateur (TipTap, shadcn/ui), les API routes Next.js implementent la logique metier '
    'et les endpoints REST, les workers BullMQ traitent les jobs longs (generation sommaire et rapport), '
    'et la couche data comprend PostgreSQL (Neon) avec l\'extension pgvector pour le stockage vectoriel, '
    'Redis (Upstash) pour la queue et le cache, et Cloudflare R2 pour le stockage des fichiers uploades. '
    'Les services externes incluent Claude via Anthropic API pour la generation, Voyage AI pour les '
    'embeddings, et Stripe pour la facturation.'
))
story.append(Spacer(1, 12))
story.append(Img('architecture-systeme.png', CONTENT_W*0.92))
story.append(Caption('Figure 1 : Architecture systeme en couches avec flux de donnees'))
story.append(Spacer(1, 18))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 2: Arborescence projet
# ═══════════════════════════════════════════════════════════════════
story.append(H1('2. Arborescence projet (Next.js App Router)'))

story.append(P(
    'L\'arborescence suit les conventions du Next.js 14 App Router avec un routage base sur les dossiers. '
    'Les routes sont organisees en trois groupes principaux : (marketing) pour les pages publiques '
    '(landing, pricing), (auth) pour l\'inscription et la connexion, et (app) pour le tableau de bord '
    'et les fonctionnalites principales. Le layout (app) inclut la sidebar de navigation et le widget '
    'de quota. Chaque route API est placee sous /api avec une structure CRUD standard.'
))

tree_headers = ['Chemin', 'Role']
tree_rows = [
    ['/app/(marketing)/page.tsx', 'Landing page publique'],
    ['/app/(marketing)/pricing/page.tsx', 'Page tarifs et plans d\'abonnement'],
    ['/app/(auth)/sign-in/', 'Formulaire de connexion (Clerk)'],
    ['/app/(auth)/sign-up/', 'Formulaire d\'inscription (Clerk)'],
    ['/app/(app)/layout.tsx', 'Sidebar + Quota widget (layout partage)'],
    ['/app/(app)/dashboard/', 'Tableau de bord utilisateur'],
    ['/app/(app)/projects/new/', 'Formulaire brief + upload fichiers'],
    ['/app/(app)/projects/[id]/', 'Vue projet / statut des jobs'],
    ['/app/(app)/projects/[id]/sommaire/', 'Editeur sommaire (etape 1)'],
    ['/app/(app)/projects/[id]/editor/', 'Split-view rapport (etape 2)'],
    ['/app/(app)/settings/billing/', 'Gestion abonnement Stripe'],
    ['/app/api/projects/', 'POST create, GET list'],
    ['/app/api/projects/[id]/', 'GET, PATCH, DELETE par projet'],
    ['/app/api/projects/[id]/files/', 'Upload fichiers vers R2'],
    ['/app/api/generation/sommaire/', 'POST vers queue BullMQ'],
    ['/app/api/generation/report/', 'POST vers queue BullMQ'],
    ['/app/api/generation/section-edit/', 'POST edition ciblee (sync)'],
    ['/app/api/generation/jobs/[jobId]/', 'GET statut job (polling/SSE)'],
    ['/app/api/rag/index-reference/', 'Admin: indexer ancien rapport'],
    ['/app/api/webhooks/stripe/', 'Webhook Stripe Billing'],
    ['/app/api/export/docx/[projectId]/', 'Export DOCX'],
    ['/app/api/export/pdf/[projectId]/', 'Export PDF'],
]
story.append(make_table(tree_headers, tree_rows, [7.5*cm, 8.5*cm]))
story.append(Caption('Tableau 2 : Arborescence des routes Next.js App Router'))

story.append(H2('2.1 Structure /lib (logique metier)'))
story.append(P(
    'Le dossier /lib contient toute la logique metier isolee des routes. Chaque sous-module est '
    'organise par domaine fonctionnel : db/ pour le schema Drizzle ORM et les queries, llm/ pour le '
    'client Anthropic et les prompts structures, rag/ pour le chunking et le retrieval vectoriel, '
    'queue/ pour BullMQ et les workers, quota/ pour le middleware de verification des quotas, '
    'export/ pour la generation DOCX/PDF, et storage/ pour le client R2. Cette separation stricte '
    'permet de tester chaque module independamment et de migrer vers NestJS si necessaire sans '
    'reecriture complete.'
))

lib_headers = ['Module', 'Fichiers cles', 'Responsabilite']
lib_rows = [
    ['db/', 'schema.ts, client.ts, queries/', 'Schema Drizzle ORM, connexion Neon, queries typees'],
    ['llm/', 'anthropic-client.ts, prompts/', 'Client Claude, prompts sommaire/section/edit'],
    ['rag/', 'chunking.ts, retriever.ts', 'Decoupage rapports, similarity search pgvector'],
    ['queue/', 'client.ts, workers/, jobs.ts', 'BullMQ setup, workers sommaire/report, enqueue'],
    ['quota/', 'check-quota.ts', 'Middleware verification quotas par tier d\'abonnement'],
    ['export/', 'docx-builder.ts, pdf-builder.ts', 'Generation DOCX (styles academiques) et PDF'],
    ['storage/', 'r2-client.ts', 'Client Cloudflare R2 (upload/download/delete)'],
]
story.append(make_table(lib_headers, lib_rows, [2.5*cm, 5*cm, 8.5*cm]))
story.append(Caption('Tableau 3 : Modules du dossier /lib'))

story.append(H2('2.2 Structure /components (composants UI)'))
story.append(P(
    'Les composants React sont organises par domaine fonctionnel. Le module editor/ contient les '
    'composants cles de l\'editeur split-view : TipTapEditor.tsx pour l\'editeur riche en lecture, '
    'SelectionToolbar.tsx pour le popup flottant au survol/sélection, DiffPanel.tsx pour le panneau '
    'droite affichant le diff avant/apres, et SommaireOutline.tsx pour l\'arborescence editable du '
    'sommaire. Le module upload/ contient FileDropzone.tsx pour le glisser-deposer de fichiers, '
    'et billing/ contient QuotaWidget.tsx et PricingTable.tsx pour l\'affichage des quotas et des '
    'plans tarifaires.'
))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 3: Schema de donnees
# ═══════════════════════════════════════════════════════════════════
story.append(H1('3. Schema de donnees complet (Drizzle ORM)'))

story.append(P(
    'Le schema de donnees est defini avec Drizzle ORM et utilise PostgreSQL avec l\'extension pgvector '
    'pour le stockage des embeddings. Chaque table metier inclut des enums PostgreSQL pour les statuts '
    'et les types. L\'isolation des donnees par utilisateur est assuree par Row Level Security (RLS) '
    'des le depart, avec une policy user_id = current_setting(\'app.current_user_id\')::uuid sur chaque '
    'table. Neon supporte RLS nativement, ce qui evite tout risque de fuite de donnees entre '
    'utilisateurs. Les rapports PFE et de stages contiennent souvent des informations sensibles '
    'd\'entreprises, ce qui rend cette isolation stricte indispensable des la premiere migration.'
))

story.append(H2('3.1 Enumerations'))
story.append(P(
    'Trois enumerations definissent les statuts principaux du systeme : subscription_tier pour les '
    'niveaux d\'abonnement (free, starter, pro), project_status pour le cycle de vie d\'un projet '
    '(draft, generating_sommaire, sommaire_ready, generating_report, report_ready, archived), et '
    'job_status pour l\'etat des jobs de generation (queued, processing, completed, failed). Ces enums '
    'sont definis au niveau PostgreSQL via pgEnum de Drizzle pour garantir l\'integrite referentielle '
    'en base et non uniquement au niveau applicatif.'
))

enum_headers = ['Enum', 'Valeurs', 'Usage']
enum_rows = [
    ['subscription_tier', 'free, starter, pro', 'Niveau d\'abonnement utilisateur, definit les quotas'],
    ['project_status', 'draft, generating_sommaire, sommaire_ready, generating_report, report_ready, archived',
     'Cycle de vie du projet, pilote le workflow de generation'],
    ['job_status', 'queued, processing, completed, failed', 'Etat des jobs BullMQ, affiche la progress bar'],
]
story.append(make_table(enum_headers, enum_rows, [3.5*cm, 6*cm, 7*cm]))
story.append(Caption('Tableau 4 : Enumerations PostgreSQL'))

story.append(H2('3.2 Tables principales'))
story.append(P(
    'Le schema comprend neuf tables principales couvrant l\'ensemble du domaine metier. La table users '
    'stocke les informations de l\'utilisateur avec ses quotas de generation et de stockage. La table '
    'projects represente un projet de rapport avec son type (PFE ou stage), sa filiere (sector) pour '
    'le matching RAG, et son statut. Les uploaded_files contiennent les fichiers de reference uploades '
    'avec le texte extrait apres parsing (PDF via pdf-parse, DOCX via mammoth). Le corpus de reference '
    'est split en deux tables : reference_reports pour les metadonnees anonymisees, et reference_chunks '
    'pour les fragments embeddes avec leurs embeddings vectoriels en 1024 dimensions (voyage-3).'
))
story.append(P(
    'La table sommaire_versions gère le versioning des sommaires avec un champ contentJson stockant '
    'l\'arborescence complete en JSON, et un flag is_validated indiquant si le sommaire est pret pour '
    'la generation du rapport. Les report_sections stockent chaque section du rapport final en HTML avec '
    'son ordre d\'affichage. La table edit_history trace chaque operation d\'edition ciblee avec le texte '
    'avant/apres et l\'instruction utilisateur, permettant de revenir en arriere. Enfin, generation_jobs '
    'suit l\'etat de chaque job de generation avec une progress bar (0-100).'
))

story.append(Spacer(1, 12))
story.append(Img('schema-entite-relation.png', CONTENT_W*0.92))
story.append(Caption('Figure 2 : Schema entite-relation complet du systeme'))
story.append(Spacer(1, 12))

story.append(H2('3.3 Details des tables'))
tbl_headers = ['Table', 'Colonnes cles', 'Notes']
tbl_rows = [
    ['users', 'id, clerkId, email, subscription_tier, quota_generations_used/limit, quota_storage_mb_used/limit',
     'clerkId unique, quotas selon tier'],
    ['projects', 'id, user_id (FK), title, type, sector, status, description',
     'type = \'pfe\' ou \'stage\', sector pour matching RAG'],
    ['uploaded_files', 'id, project_id (FK), file_url, file_name, mime_type, size_bytes, extracted_text',
     'extracted_text rempli apres parsing PDF/DOCX'],
    ['reference_reports', 'id, sector, report_type, source_label',
     'source_label anonymise pour conformite legale'],
    ['reference_chunks', 'id, reference_report_id (FK), section_key, content, embedding (vector 1024)',
     'vector pgvector voyage-3, section_key = type de section'],
    ['sommaire_versions', 'id, project_id (FK), content_json (JSONB), version, is_validated',
     'versioning simple, JSON pour arborescence flexible'],
    ['report_sections', 'id, project_id (FK), section_key, title, content_html, order_index',
     'content_html pour rendu TipTap direct'],
    ['edit_history', 'id, report_section_id (FK), selected_text, instruction, before_content, after_content, accepted',
     'Audit complet de chaque edition ciblee'],
    ['generation_jobs', 'id, project_id (FK), type, status, progress, error_message',
     'type = \'sommaire\' ou \'full_report\', progress 0-100'],
]
story.append(make_table(tbl_headers, tbl_rows, [3*cm, 6.5*cm, 6.5*cm]))
story.append(Caption('Tableau 5 : Details des tables du schema de donnees'))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 4: Pipeline RAG
# ═══════════════════════════════════════════════════════════════════
story.append(H1('4. Pipeline RAG (coeur du produit)'))

story.append(P(
    'Le pipeline RAG est le coeur differentiant de la plateforme. Il se decompose en trois phases '
    'distinctes : l\'indexation offline du corpus de reference, la generation du sommaire structure, '
    'et la generation du rapport complet section par section. Chaque phase exploite les embeddings '
    'voyage-3 stockes dans pgvector pour retrouver les passages les plus pertinents et les injecter '
    'dans les prompts Claude, garantissant ainsi des rapports coherents avec le ton, la structure et '
    'les formulations des rapports academiques de reference de la meme filiere.'
))

story.append(H2('4.1 Phase 1 : Indexation offline du corpus'))
story.append(P(
    'L\'indexation se fait en une seule fois via un script admin (pas d\'UI necessaire en phase test). '
    'Le processus est le suivant : les anciens rapports sont chunks par section (introduction, contexte '
    'de l\'entreprise, methodologie, resultats, conclusion, etc.), chaque chunk est embedde via Voyage AI '
    'en un vecteur de 1024 dimensions, puis stocke dans la table reference_chunks avec des metadonnees '
    '(section_key, filiere, type de rapport). L\'extraction du texte se fait via pdf-parse pour les PDF '
    'et mammoth pour les DOCX. Il est imperatif de verifier le droit d\'utiliser ces rapports de '
    'reference (consentement des auteurs ou anonymisation complete), car les PFE et stages contiennent '
    'souvent des informations confidentielles sur les entreprises d\'accueil.'
))

story.append(H2('4.2 Phase 2 : Generation du sommaire'))
story.append(P(
    'Lorsque l\'utilisateur valide son brief projet, le backend envoie le brief a Voyage AI pour obtenir '
    'un embedding, puis effectue une similarity search dans reference_chunks filtree par sector et '
    'report_type. Les top-K structures de sommaires similaires sont recuperees et injectees dans un prompt '
    'structure destine a Claude. Ce prompt contient le brief de l\'etudiant, les exemples de structures '
    'de sommaires similaires, et demande une sortie JSON stricte definissant les sections et sous-sections. '
    'Le resultat est sauvegarde dans sommaire_versions avec version = 1 et is_validated = false.'
))

story.append(H2('4.3 Phase 3 : Generation du rapport complet'))
story.append(P(
    'Apres validation du sommaire par l\'utilisateur, la generation du rapport complet est declenchee '
    'via un job BullMQ (car la generation prend 1 a 3 minutes). Le worker traite chaque section du '
    'sommaire validé separement, et non en un seul prompt. Pour chaque section, il effectue un retrieval '
    'dans reference_chunks filtre par section_key similaire, recupere les top-5 passages de reference, '
    'puis construit un prompt Claude avec le contexte du projet, les sections precedentes deja generees '
    '(pour la coherence), et les exemples de reference. Cette approche section par section permet une '
    'reprise sur erreur, une barre de progression reelle, et la regeneration ciblee d\'une section sans '
    'tout refaire.'
))

story.append(Spacer(1, 12))
story.append(Img('pipeline-rag.png', CONTENT_W*0.92))
story.append(Caption('Figure 3 : Pipeline RAG complet (indexation, generation sommaire, generation rapport)'))
story.append(Spacer(1, 18))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 5: Pipeline detaille par etape
# ═══════════════════════════════════════════════════════════════════
story.append(H1('5. Pipeline detaille par etape'))

story.append(H2('5.1 Etape A : Onboarding projet'))
story.append(P(
    'L\'onboarding commence par la creation du projet via POST /api/projects, qui cree un enregistrement '
    'en statut draft dans la table projects. Ensuite, l\'utilisateur uploade ses fichiers (brief, supports, '
    'captures d\'ecran) via POST /api/projects/[id]/files. Chaque fichier est stocke dans Cloudflare R2, '
    'puis le texte est extrait : PDF via pdf-parse, DOCX via mammoth, images via Claude Vision si un '
    'contexte visuel est necessaire. Avant l\'upload, le middleware check-quota.ts verifie que la taille '
    'totale et le nombre de fichiers sont compatibles avec le tier d\'abonnement de l\'utilisateur.'
))

story.append(H2('5.2 Etape B : Generation sommaire'))
story.append(P(
    'POST /api/generation/sommaire envoie immediatement un jobId (HTTP 202) et enqueue le job dans '
    'BullMQ. Le worker (sommaire-worker.ts) execute la logique RAG decrite au chapitre precedent. '
    'Le frontend fait du polling sur GET /api/generation/jobs/[jobId] ou utilise SSE (Server-Sent '
    'Events) via ReadableStream de Next.js pour un suivi en temps reel de la progression. Une fois '
    'termine, le resultat est sauvegarde dans sommaire_versions et generation_jobs.status passe a '
    'completed. L\'utilisateur est redirige vers l\'editeur de sommaire.'
))

story.append(H2('5.3 Etape C : Edition iterative du sommaire'))
story.append(P(
    'L\'interface SommaireOutline.tsx presente une arborescence editable avec drag-drop pour le '
    'reordonnancement, ajout/suppression de sections, et edition inline des titres. Chaque modification '
    'cree une nouvelle version dans sommaire_versions (version incrementale). Le bouton "Valider" passe '
    'is_validated a true et declenche l\'etape D. Le versioning est simple (pas de diff complexe), ce '
    'qui suffit pour une phase test.'
))

story.append(H2('5.4 Etape D : Generation rapport complet'))
story.append(P(
    'POST /api/generation/report enqueue un second job BullMQ. Le worker (report-worker.ts) itere sur '
    'chaque section du sommaire valide. Pour chaque section, il effectue un retrieval dans '
    'reference_chunks, genere le contenu via Claude, sauvegarde dans report_sections, et met a jour '
    'la progress bar du job (0 a 100%). L\'approche section par section garantit la coherence contextuelle '
    'car chaque prompt inclut les sections precedentes deja generees. En cas d\'erreur sur une section, '
    'le worker peut reprendre sans regenerer les sections deja terminees.'
))

story.append(H2('5.5 Etape E : Editeur split-view'))
story.append(P(
    'L\'editeur split-view est la partie la plus differenciante du produit. A gauche, TipTapEditor.tsx '
    'affiche le rapport en mode lecture avec les report_sections chargees en HTML. L\'evenement '
    'onSelectionUpdate de TipTap capture la selection structuree : { from, to, selectedText, sectionId }. '
    'SelectionToolbar.tsx affiche un popup flottant "Modifier ce passage" qui ouvre le panneau droit.'
))
story.append(P(
    'Le panneau droit (DiffPanel.tsx) presente un champ libre pour l\'instruction utilisateur '
    '("rends ce paragraphe plus formel", "ajoute un exemple concret", "raccourcis"), puis envoie un '
    'POST /api/generation/section-edit de maniere synchrone (pas de queue, car c\'est rapide). Le backend '
    'reconstruit le contexte (section entiere + passage selectionne + instruction), appelle Claude avec '
    'un prompt cible "modifie uniquement ce passage, garde la coherence avec le reste", et retourne '
    '{ before: selectedText, after: result.newText }.'
))
story.append(P(
    'Le diff s\'affiche avec le texte original barre en rouge et le texte propose en vert (via diff-match-patch '
    'pour un diff mot-a-mot). Trois actions sont possibles : Accepter (patch applique dans TipTap via '
    'editor.chain().focus().insertContentAt({from, to}, newContent).run(), ce qui remplace le passage '
    'selectionne sans re-render complet du document), Rejeter (retour a l\'original), ou Regenerer '
    '(nouvel appel Claude avec la meme instruction). Chaque edition est tracee dans edit_history.'
))

story.append(Spacer(1, 12))
story.append(Img('flux-utilisateur.png', CONTENT_W*0.92))
story.append(Caption('Figure 4 : Flux utilisateur complet de l\'inscription a l\'export'))
story.append(Spacer(1, 18))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 6: Gestion des quotas et Stripe
# ═══════════════════════════════════════════════════════════════════
story.append(H1('6. Gestion des quotas et Stripe Billing'))

story.append(H2('6.1 Middleware de verification des quotas'))
story.append(P(
    'Le fichier lib/quota/check-quota.ts exporte une fonction checkQuota(userId, action, size?) qui '
    'est appelee au debut de chaque route sensible (generation/*, files). La fonction verifie que '
    'l\'utilisateur n\'a pas depasse sa limite de generations ou de stockage selon son tier d\'abonnement. '
    'Le quota est incremente apres succes uniquement (pas avant) pour ne pas penaliser un echec. En cas '
    'de depassement, une erreur QuotaExceededError est levee et interceptee par le handler d\'erreur '
    'global, qui retourne un HTTP 429 avec un message invitant l\'utilisateur a upgrader son abonnement.'
))
story.append(Code(
    '// lib/quota/check-quota.ts<br/>'
    'export async function checkQuota(userId, action, size?) {<br/>'
    '&nbsp;&nbsp;const user = await getUserWithQuota(userId);<br/>'
    '&nbsp;&nbsp;if (action === \'generation\' &&amp; user.quotaGenerationsUsed >= user.quotaGenerationsLimit)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;throw new QuotaExceededError(\'generation_limit_reached\');<br/>'
    '&nbsp;&nbsp;if (action === \'upload\' &amp;&amp; (user.quotaStorageMbUsed + size) > user.quotaStorageMbLimit)<br/>'
    '&nbsp;&nbsp;&nbsp;&nbsp;throw new QuotaExceededError(\'storage_limit_reached\');<br/>'
    '}'
))

story.append(H2('6.2 Tiers d\'abonnement suggeres'))
story.append(P(
    'Trois tiers sont proposes pour la phase test, calibres pour 25 utilisateurs. Le tier free permet '
    'de decouvrir le produit avec une generation et 20 Mo de stockage. Le tier starter offre 3 '
    'generations et 100 Mo de stockage a un prix abordable. Le tier pro enleve la limite de generations '
    'ciblees et offre 500 Mo de stockage, adapte aux utilisateurs intensifs. Les prix sont exprimes '
    'en DT (dinars tunisiens) mais Stripe gere la conversion automatique.'
))

tier_headers = ['Tier', 'Prix', 'Generations/mois', 'Stockage', 'Editions ciblees']
tier_rows = [
    ['Free', '0 DT', '1', '20 Mo', '10'],
    ['Starter', '15 DT/mois', '3', '100 Mo', 'Illimite'],
    ['Pro', '35 DT/mois', '10', '500 Mo', 'Illimite'],
]
story.append(make_table(tier_headers, tier_rows, [2.5*cm, 3*cm, 4*cm, 3*cm, 4.5*cm]))
story.append(Caption('Tableau 6 : Tiers d\'abonnement proposes'))

story.append(H2('6.3 Webhook Stripe'))
story.append(P(
    'Le webhook stripe/route.ts ecoute les evenements Stripe (customer.subscription.updated, '
    'invoice.paid, etc.) pour synchroniser le tier d\'abonnement dans la table users et reset les '
    'quotas a chaque cycle de facturation. Le secret de verification du webhook est stocke dans les '
    'variables d\'environnement Vercel et jamais expose cote client.'
))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 7: Export final
# ═══════════════════════════════════════════════════════════════════
story.append(H1('7. Export final (DOCX et PDF)'))

story.append(P(
    'L\'export est la derniere etape du flux utilisateur. Deux formats sont proposes : DOCX pour '
    'les utilisateurs qui souhaitent modifier le rapport dans Word ou WPS Office, et PDF pour '
    'une version prete a imprimer ou a soumettre. Les deux formats utilisent les report_sections '
    'triees par order_index comme source de donnees.'
))

story.append(H2('7.1 Export DOCX'))
story.append(P(
    'Le module lib/export/docx-builder.ts itere sur les report_sections triees par order_index et '
    'construit un fichier .docx via la librairie docx (npm). Les styles academiques sont appliques '
    'automatiquement : Titre 1 pour les sections principales, Titre 2 pour les sous-sections, Titre 3 '
    'pour les sous-sous-sections, avec une numerotation automatique. Une table des matieres auto-generee '
    'via le champ Word TOC est incluse en debut de document. Le rendu est fidele aux standards academiques '
    'PFE/stages tunisiens.'
))

story.append(H2('7.2 Export PDF'))
story.append(P(
    'Le module lib/export/pdf-builder.ts utilise Puppeteer pour convertir un rendu HTML/CSS en PDF. '
    'Cette approche permet un controle precis sur la mise en page (marges, en-tetes, pieds de page, '
    'numerotation) et un rendu visuellement fidele a un rapport academique type LaTeX, sans necessite '
    'un compilateur LaTeX. L\'alternative est la conversion DOCX vers PDF via LibreOffice headless, '
    'mais le rendu Puppeteer est plus fiable pour les mises en page complexes.'
))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 8: Points d'attention et securite
# ═══════════════════════════════════════════════════════════════════
story.append(H1('8. Points d\'attention et securite'))

story.append(H2('8.1 Confidentialite et isolation des donnees'))
story.append(P(
    'Les rapports PFE et de stages contiennent souvent des informations confidentielles sur les '
    'entreprises d\'accueil (donnees financieres, strategies, projets en cours). L\'isolation stricte '
    'par utilisateur est assuree par Row Level Security (RLS) PostgreSQL des la premiere migration, '
    'et non pas uniquement par un WHERE user_id au niveau applicatif. Cela signifie que meme si un '
    'bug dans le code oubli le filtre user_id, la base de donnees bloquera l\'acces aux donnees '
    'd\'un autre utilisateur. Neon supporte RLS nativement en serverless.'
))

story.append(H2('8.2 Suivi des couts API'))
story.append(P(
    'Chaque appel Claude est logge avec les tokens in/out par utilisateur dans une table '
    'api_usage_logs (non detaillee dans le schema principal pour simplicite). Cela permet de calculer '
    'le cout reel par utilisateur et d\'anticiper la marge par tier d\'abonnement. En phase test, '
    'cette donnee est essentielle pour calibrer les prix avant le lancement public.'
))

story.append(H2('8.3 Corpus de reference : conformite legale'))
story.append(P(
    'L\'utilisation d\'anciens rapports comme corpus de reference necessite le consentement explicite '
    'des auteurs ou une anonymisation complete. Ce point est particulierement sensible dans le contexte '
    'd\'un PFE sur l\'audit, ou les rapports contiennent des donnees d\'entreprises confidentielles. '
    'Il est recommande de ne stocker que les structures et formulations types, pas les donnees '
    'specifiques aux entreprises, et de mettre en place une politique de retention/forgetting.'
))

story.append(H2('8.4 Rate limiting et securite API'))
story.append(P(
    'Un rate limiting est applique sur les endpoints de generation via un middleware qui verifie '
    'le nombre de requetes par minute et par utilisateur. Les cles API (Anthropic, Voyage AI, Stripe) '
    'sont stockees exclusivement dans les variables d\'environnement Vercel et ne sont jamais exposees '
    'cote client. Le CORS est configure pour n\'autoriser que le domaine de l\'application. Les '
    'webhooks Stripe utilisent la verification de signature pour se proteger contre les requetes '
    'non autorisees.'
))

# ═══════════════════════════════════════════════════════════════════
# CHAPTER 9: Ordre de vibecoding recommande
# ═══════════════════════════════════════════════════════════════════
story.append(H1('9. Ordre de vibecoding recommande'))

story.append(P(
    'L\'ordre de developpement est optimise pour le vibecoding avec Claude Code : chaque etape est '
    'independante et testable, ce qui permet de valider rapidement chaque brique avant de passer a '
    'la suivante. L\'etape la plus delicate et la plus longue est l\'editeur TipTap + split-view, '
    'il est recommande de prevoir le plus de temps pour cette partie.'
))
story.append(Spacer(1, 12))

road_headers = ['Phase', 'Tache', 'Estimation', 'Dependances']
road_rows = [
    ['1', 'Setup Next.js 14 + Drizzle ORM + Neon + RLS de base + Clerk Auth', '1-2 jours', 'Aucune'],
    ['2', 'CRUD projets + upload fichiers vers R2 + extraction texte', '1-2 jours', 'Phase 1'],
    ['3', 'Indexation manuelle du corpus de reference + pgvector', '1 jour', 'Phase 2'],
    ['4', 'Pipeline generation sommaire (sync d\'abord, puis BullMQ)', '2-3 jours', 'Phases 2-3'],
    ['5', 'UI sommaire editable (drag-drop, versioning)', '1-2 jours', 'Phase 4'],
    ['6', 'Pipeline generation rapport complet (queue + progress)', '2-3 jours', 'Phase 5'],
    ['7', 'Editeur TipTap + split-view + edition ciblee', '3-5 jours', 'Phase 6'],
    ['8', 'Export DOCX/PDF', '1-2 jours', 'Phase 6'],
    ['9', 'Stripe Billing + quotas', '1-2 jours', 'Phase 1'],
    ['10', 'Monitoring (Sentry) + polish UI', '1 jour', 'Phases 7-9'],
]
story.append(make_table(road_headers, road_rows, [1.5*cm, 7*cm, 2.5*cm, 3.5*cm]))
story.append(Caption('Tableau 7 : Roadmap de vibecoding avec estimations'))

story.append(H2('9.1 Estimation de couts (25 utilisateurs en test)'))

cost_headers = ['Service', 'Cout mensuel estime', 'Notes']
cost_rows = [
    ['Vercel (Hobby)', '0 $', 'Gratuit pour projets personnels'],
    ['Neon (Free tier)', '0 $', '0.5 Go stockage, 100h compute'],
    ['Upstash Redis', '0-5 $', 'Pay-per-use, negligeable a 25 users'],
    ['Cloudflare R2', '0-2 $', '10 Go gratuit, pas d\'egress fees'],
    ['Anthropic Claude API', '10-30 $', 'Variable selon usage, loguer par user'],
    ['Voyage AI Embeddings', '2-5 $', 'Indexation initiale + requetes'],
    ['Stripe', '0 $', 'Pas de frais tant que pas de transactions reelles'],
    ['Sentry (Free)', '0 $', '5 000 events/mois gratuit'],
    ['Total estime', '12-42 $/mois', 'Hors API Claude a l\'usage reel'],
]
story.append(make_table(cost_headers, cost_rows, [4*cm, 4*cm, 8*cm]))
story.append(Caption('Tableau 8 : Estimation des couts mensuels en phase test'))

# ═══════════════════════════════════════════════════════════════════
# BUILD PDF
# ═══════════════════════════════════════════════════════════════════
doc = TocDocTemplate(
    OUTPUT_BODY,
    pagesize=A4,
    leftMargin=MARGIN_L,
    rightMargin=MARGIN_R,
    topMargin=MARGIN_T,
    bottomMargin=MARGIN_B,
    title='Architecture Technique - Plateforme SaaS RAG',
    author='Z.ai',
    subject='Document d\'architecture technique pour vibecoding Claude Code'
)

doc.multiBuild(story, onLaterPages=add_page_number, onFirstPage=lambda c, d: None)
print(f"Body PDF generated: {OUTPUT_BODY}")

# ─── Merge cover + body ───
def normalize_page(page):
    """Scale cover page to exact A4 dimensions."""
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    # Scale to exact A4 (595.28 x 841.89)
    page.scale_to(595.28, 841.89)
    return page

cover_path = os.path.join(DIAGRAMS_DIR, 'cover.pdf')
writer = PdfWriter()

# Cover first
cover_page = PdfReader(cover_path).pages[0]
writer.add_page(normalize_page(cover_page))

# Body pages
for page in PdfReader(OUTPUT_BODY).pages:
    writer.add_page(normalize_page(page))

writer.add_metadata({
    '/Title': 'Architecture Technique - Plateforme SaaS RAG pour Generation de Rapports Academiques',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Architecture technique complete pour vibecoding Claude Code'
})

os.makedirs(os.path.dirname(OUTPUT_FINAL), exist_ok=True)
with open(OUTPUT_FINAL, 'wb') as f:
    writer.write(f)

print(f"Final PDF merged: {OUTPUT_FINAL}")
