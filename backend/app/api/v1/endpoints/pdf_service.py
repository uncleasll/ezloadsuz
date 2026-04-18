"""
Invoice PDF — matches sample PDF exactly:
- TOPTRUCK logo box (left) | From: Silkroad llc ... | To: Broker
- Invoice #XXXX title
- Date / Due date / PO number / Route / Driver
- Table: # | Date | Delivery | Description | Amount  (dark header)
- Total row (right-aligned, bold)
"""
import io
from datetime import date, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer
)
from app.models.models import Load
from app.services.company_service import get_company
from app.db.session import SessionLocal


DARK   = colors.HexColor("#111827")
GRAY   = colors.HexColor("#6b7280")
BORDER = colors.HexColor("#cccccc")
TH_BG  = colors.HexColor("#1a2332")   # dark navy header matching UI


def _fmt_date(d) -> str:
    if not d:
        return ""
    try:
        return d.strftime("%m/%d/%y")
    except Exception:
        return str(d)


def generate_invoice_pdf(load: Load, db=None) -> bytes:
    # Get company settings
    _db = db
    _close = False
    if _db is None:
        _db = SessionLocal()
        _close = True
    try:
        company = get_company(_db)
    finally:
        if _close and _db:
            _db.close()
    co_name   = company["name"] or "My Company"
    co_email  = company["email"] or ""
    co_phone  = company["phone"] or ""
    co_addr   = ", ".join(filter(None, [company["city"], company["state"], company["zip_code"]]))
    mc = ("MC#: " + company["mc_number"]) if company["mc_number"] else ""
    dot = ("DOT#: " + company["dot_number"]) if company["dot_number"] else ""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )

    story = []

    # ── Styles ────────────────────────────────────────────────────────────────
    normal = ParagraphStyle("n", fontName="Helvetica", fontSize=9, leading=13, textColor=DARK)
    bold   = ParagraphStyle("b", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=DARK)
    small  = ParagraphStyle("s", fontName="Helvetica", fontSize=8, leading=11, textColor=GRAY)

    def P(text, style=normal): return Paragraph(text, style)

    # ── Top header table: logo | From | To ────────────────────────────────────
    broker_name = load.broker.name if load.broker else ""
    broker_addr = f"{load.broker.city or ''}, {load.broker.state or ''}" if load.broker else ""
    from_text = (
        "From:<br/>"
        f"<b>{co_name}</b><br/>"
        + (f"{co_addr}<br/>" if co_addr else "")
        + (f"Email: {co_email}<br/>" if co_email else "")
        + (f"Phone: {co_phone}" if co_phone else "")
    )
    to_text = (
        "To:<br/>"
        f"<b>{broker_name}</b><br/>"
        f"{broker_addr}<br/>"
    )

    logo_cell = Table(
        [[P(f"<b>{co_name}</b>", bold)]],
        colWidths=[0.7 * inch, 0.6 * inch],
    )
    logo_cell.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    header_tbl = Table(
        [[logo_cell, P(from_text, normal), P(to_text, normal)]],
        colWidths=[1.4 * inch, 3.4 * inch, 2.3 * inch],
    )
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("LINEAFTER", (0, 0), (1, 0), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 14))

    # ── Invoice title ─────────────────────────────────────────────────────────
    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=13, textColor=DARK, spaceAfter=6)
    story.append(Paragraph(f"Invoice #{load.load_number}", title_style))

    # Invoice date = actual_delivery_date or load_date
    inv_date = load.actual_delivery_date or load.load_date
    due_date = (inv_date + timedelta(days=30)) if inv_date else None

    pickup = next((s for s in load.stops if s.stop_type.value == "pickup"), None)
    delivery = next((s for s in load.stops if s.stop_type.value == "delivery"), None)
    pickup_loc  = f"{pickup.city}, {pickup.state}"   if pickup   else ""
    delivery_loc = f"{delivery.city}, {delivery.state}" if delivery else ""
    route = f"{pickup_loc} - {delivery_loc}" if pickup_loc or delivery_loc else ""

    driver_name = load.driver.name if load.driver else ""
    truck_unit  = load.truck.unit_number if load.truck else ""
    trailer_unit = load.trailer.unit_number if load.trailer else ""

    meta_style = ParagraphStyle("meta", fontName="Helvetica", fontSize=9, leading=14, textColor=DARK)
    story.append(Paragraph(f"Date: {_fmt_date(inv_date)}", meta_style))
    story.append(Paragraph(f"Due date: {_fmt_date(due_date)}", meta_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"PO number: {load.po_number or ''}", meta_style))
    story.append(Paragraph(route, meta_style))
    story.append(Paragraph(f"{driver_name} / {truck_unit} / {trailer_unit}", meta_style))
    story.append(Spacer(1, 14))

    # ── Invoice line items table ───────────────────────────────────────────────
    th_style = ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=9, textColor=colors.white, alignment=TA_LEFT)
    th_r     = ParagraphStyle("thr", fontName="Helvetica-Bold", fontSize=9, textColor=colors.white, alignment=TA_RIGHT)
    td_style = ParagraphStyle("td", fontName="Helvetica", fontSize=9, textColor=DARK, alignment=TA_LEFT)
    td_r     = ParagraphStyle("tdr", fontName="Helvetica", fontSize=9, textColor=DARK, alignment=TA_RIGHT)
    td_rb    = ParagraphStyle("tdrb", fontName="Helvetica-Bold", fontSize=9, textColor=DARK, alignment=TA_RIGHT)

    table_data = [[
        Paragraph("#", th_style),
        Paragraph("Date", th_style),
        Paragraph("Delivery", th_style),
        Paragraph("Description", th_style),
        Paragraph("Amount", th_r),
    ]]

    # Base load line (only if rate > 0)
    rows = []
    if load.rate and load.rate > 0:
        desc = f"Miles: {pickup_loc} - {delivery_loc} distance: {load.loaded_miles}mi/{load.empty_miles}mi"
        rows.append({
            "date": _fmt_date(load.load_date),
            "delivery": _fmt_date(load.actual_delivery_date),
            "description": desc,
            "amount": load.rate,
        })

    # Services
    for svc in load.services:
        svc_delivery = _fmt_date(delivery.stop_date if delivery else None)
        svc_delivery_loc = delivery_loc
        desc = f"{svc.service_type.value} advanced/Delivery: {svc_delivery_loc}"
        if svc.notes:
            desc += f" - {svc.notes}"
        amt = svc.invoice_amount if svc.add_deduct == "Add" else -svc.invoice_amount
        rows.append({
            "date": _fmt_date(svc.created_at.date() if svc.created_at else load.load_date),
            "delivery": svc_delivery,
            "description": desc,
            "amount": amt,
        })

    if not rows:
        rows.append({"date": _fmt_date(load.load_date), "delivery": _fmt_date(load.actual_delivery_date), "description": "No items", "amount": 0})

    for i, row in enumerate(rows):
        amt_str = f"${row['amount']:,.2f}" if row["amount"] >= 0 else f"-${abs(row['amount']):,.2f}"
        table_data.append([
            Paragraph(str(i + 1), td_style),
            Paragraph(row["date"], td_style),
            Paragraph(row["delivery"], td_style),
            Paragraph(row["description"], td_style),
            Paragraph(amt_str, td_r),
        ])

    # Total
    total = sum(r["amount"] for r in rows)
    total_str = f"${total:,.2f}" if total >= 0 else f"-${abs(total):,.2f}"
    table_data.append([
        Paragraph("", td_style),
        Paragraph("", td_style),
        Paragraph("", td_style),
        Paragraph("Total:", td_rb),
        Paragraph(total_str, td_rb),
    ])

    col_w = [0.3*inch, 0.8*inch, 0.8*inch, 4.3*inch, 1.0*inch]
    tbl = Table(table_data, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), TH_BG),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        # Grid
        ("GRID", (0, 0), (-1, -2), 0.5, BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1, DARK),
        # Row alternating
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f9f9f9")]),
        # Total row
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fffbe6")),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(tbl)

    doc.build(story)
    buf.seek(0)
    return buf.read()



def generate_settlement_pdf(settlement, db=None) -> bytes:
    """
    Driver Pay Report PDF — matches the sample PDF layout.

    Layout:
    ─────────────────────────────────────────────────
    Driver Pay Report              (centered title)
    Driver name + address (left) | Company name/addr (right)
    Work Period [from] ~ [to]      (centered bold)

    For each load item — bordered block:
        Load # | Pickup | Delivery | Rate | Notes
        Rate formula:  $X.XX × YY% = $Z.ZZ
        Total Pay: $Z.ZZ  (right)

    Adjustments / Recurring Deductions table
    Subtotal, Grand Total
    ─────────────────────────────────────────────────
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        rightMargin=0.65*inch, leftMargin=0.65*inch,
        topMargin=0.7*inch, bottomMargin=0.85*inch,
    )
    story = []

    BLACK   = colors.HexColor("#111111")
    BORDER  = colors.HexColor("#aaaaaa")
    LIGHT_GRAY = colors.HexColor("#f5f5f5")
    MID_GRAY   = colors.HexColor("#dddddd")

    title_style = ParagraphStyle("tit", fontName="Helvetica-Bold", fontSize=14,
                                 leading=18, textColor=BLACK, alignment=TA_CENTER)
    head_l  = ParagraphStyle("hl", fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=BLACK)
    head_r  = ParagraphStyle("hr", fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=BLACK, alignment=TA_RIGHT)
    sub_l   = ParagraphStyle("sl", fontName="Helvetica", fontSize=9, leading=13, textColor=BLACK)
    sub_r   = ParagraphStyle("sr", fontName="Helvetica", fontSize=9, leading=13, textColor=BLACK, alignment=TA_RIGHT)
    period_s= ParagraphStyle("per",fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=BLACK, alignment=TA_CENTER)
    lbl_s   = ParagraphStyle("lbl",fontName="Helvetica-Bold", fontSize=9,  leading=13, textColor=BLACK)
    val_s   = ParagraphStyle("val",fontName="Helvetica",      fontSize=9,  leading=13, textColor=BLACK)
    val_r   = ParagraphStyle("vr", fontName="Helvetica",      fontSize=9,  leading=13, textColor=BLACK, alignment=TA_RIGHT)
    val_rb  = ParagraphStyle("vrb",fontName="Helvetica-Bold", fontSize=9,  leading=13, textColor=BLACK, alignment=TA_RIGHT)
    formula_s = ParagraphStyle("frm",fontName="Helvetica", fontSize=9, leading=13, textColor=BLACK)
    deduct_h  = ParagraphStyle("dh", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=BLACK)
    total_s   = ParagraphStyle("tot",fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=BLACK)
    total_r   = ParagraphStyle("tr", fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=BLACK, alignment=TA_RIGHT)
    footer_s  = ParagraphStyle("ft", fontName="Helvetica", fontSize=8, leading=12,
                                textColor=colors.HexColor("#666666"), alignment=TA_CENTER)

    def P(txt, s=val_s): return Paragraph(str(txt) if txt else "", s)
    def HR(): return Table([[""]], colWidths=[7.2*inch], rowHeights=[1])

    driver = settlement.driver
    drv_name = driver.name if driver else ""
    payable_to = settlement.payable_to or drv_name

    # Try to get driver address from profile
    drv_address1 = ""
    drv_address2 = ""
    drv_phone = driver.phone if driver else ""
    drv_email = driver.email if driver else ""

    # Find date range from load items
    item_dates = []
    for item in (settlement.items or []):
        if item.load_date:
            item_dates.append(item.load_date)
    date_from = min(item_dates) if item_dates else settlement.date
    date_to   = max(item_dates) if item_dates else settlement.date

    # ── Title ─────────────────────────────────────────────────────────────────
    story.append(P("Driver Pay Report", title_style))
    story.append(Spacer(1, 10))

    # ── Header: driver info (left) | company info (right) ─────────────────────
    left_block = [
        P(payable_to, head_l),
    ]
    if drv_address1:
        left_block.append(P(drv_address1, sub_l))
    if drv_address2:
        left_block.append(P(drv_address2, sub_l))
    if drv_phone:
        left_block.append(P(drv_phone, sub_l))
    if drv_email:
        left_block.append(P(drv_email, sub_l))

    right_block = [
        P(co_name, head_r),
    ]
    if co_email:
        right_block.append(P(f"Email: {co_email}", sub_r))
    if co_phone:
        right_block.append(P(f"Phone: {co_phone}", sub_r))

    hdr_tbl = Table(
        [[left_block, right_block]],
        colWidths=[3.6*inch, 3.6*inch],
    )
    hdr_tbl.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 10))

    # ── Horizontal rule ────────────────────────────────────────────────────────
    hr_tbl = Table([[""]], colWidths=[7.2*inch])
    hr_tbl.setStyle(TableStyle([("LINEBELOW", (0,0),(0,0), 1.0, BLACK), ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),2)]))
    story.append(hr_tbl)
    story.append(Spacer(1, 6))

    # ── Work Period ─────────────────────────────────────────────────────────────
    story.append(P(f"Work Period  [{_fmt_date(date_from)}]  ~  [{_fmt_date(date_to)}]", period_s))
    story.append(Spacer(1, 12))

    # ── Load items ─────────────────────────────────────────────────────────────
    load_items = [i for i in (settlement.items or []) if i.item_type == "load"]
    subtotal = 0.0

    for item in load_items:
        load = item.load
        if not load:
            continue

        # Determine pay description
        pay_type = load.pay_type_snapshot or "per_mile"
        amount = item.amount_snapshot if item.amount_snapshot is not None else item.amount
        subtotal += amount

        if pay_type == "percentage":
            pct = load.freight_percentage_snapshot or 0.0
            formula = f"${load.rate:,.2f} × {pct:.0f}% = ${amount:,.2f}"
        elif pay_type == "flatpay":
            formula = f"Flat pay = ${amount:,.2f}"
        else:
            rate_l = load.pay_rate_loaded_snapshot or 0.65
            rate_e = load.pay_rate_empty_snapshot or 0.30
            formula = f"${load.rate:,.2f}  (${rate_l}/mi loaded, ${rate_e}/mi empty)"

        # Pickup / delivery
        pickup_city   = item.load_pickup_city or ""
        delivery_city = item.load_delivery_city or ""
        # Try to get more detail from stops
        if load.stops:
            for stop in load.stops:
                t = stop.stop_type.value if hasattr(stop.stop_type, 'value') else str(stop.stop_type)
                if t == 'pickup' and not pickup_city:
                    pickup_city = f"{stop.city or ''}, {stop.state or ''}"
                elif t == 'delivery' and not delivery_city:
                    delivery_city = f"{stop.city or ''}, {stop.state or ''}"

        load_num = load.load_number if load else ""

        # Build the load block as a bordered table
        # Header row: formula (left) | date pickup | date delivery
        pick_date = ""
        del_date  = ""
        if load.stops:
            for stop in load.stops:
                t = stop.stop_type.value if hasattr(stop.stop_type, 'value') else str(stop.stop_type)
                if t == 'pickup'   and stop.stop_date: pick_date = _fmt_date(stop.stop_date)
                if t == 'delivery' and stop.stop_date: del_date  = _fmt_date(stop.stop_date)

        # Row: pickup date / delivery date
        date_row = f"{pick_date}  →  {del_date}" if pick_date or del_date else _fmt_date(item.load_date)

        block_data = [
            # Row 1: date + load# on left, total pay on right
            [P(f"<b>{date_row}  &nbsp;&nbsp; Load# {load_num}</b>", lbl_s),
             P(f"<b>Total Pay: ${amount:,.2f}</b>", val_rb)],
            # Row 2: pickup / delivery
            [P(f"Pickup: {pickup_city}", val_s),  P("")],
            [P(f"Delivery: {delivery_city}", val_s), P("")],
            # Row 3: rate formula
            [P(f"Rate:  {formula}", val_s), P("")],
            # Row 4: notes
            [P(f"Notes: ", val_s), P("")],
        ]

        blk_tbl = Table(block_data, colWidths=[5.4*inch, 1.8*inch])
        blk_tbl.setStyle(TableStyle([
            ("BOX",    (0,0), (-1,-1), 0.5, BORDER),
            ("LINEBELOW", (0,0), (-1,0), 0.5, BORDER),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
            ("RIGHTPADDING",  (0,0),(-1,-1), 8),
            ("VALIGN",  (0,0),(-1,-1), "TOP"),
            ("BACKGROUND", (0,0),(-1,0), LIGHT_GRAY),
        ]))
        story.append(blk_tbl)
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 6))

    # ── Adjustments / Recurring Deductions ────────────────────────────────────
    adjustments = list(settlement.adjustments or [])
    if adjustments:
        story.append(P("<b>Recurring Deduction</b>", deduct_h))
        story.append(Spacer(1, 4))
        ded_data = []
        for adj in adjustments:
            label = adj.category or adj.description or adj.adj_type
            sign  = "+" if adj.adj_type == "addition" else ""
            amt   = adj.amount if adj.adj_type == "addition" else -adj.amount
            amt_str = f"${abs(amt):,.2f}" if amt >= 0 else f"-${abs(amt):,.2f}"
            ded_data.append([P(label, val_s), P(amt_str, val_r)])

        ded_tbl = Table(ded_data, colWidths=[5.5*inch, 1.7*inch])
        ded_tbl.setStyle(TableStyle([
            ("BOX",   (0,0),(-1,-1), 0.5, BORDER),
            ("GRID",  (0,0),(-1,-1), 0.3, MID_GRAY),
            ("TOPPADDING",    (0,0),(-1,-1), 4),
            ("BOTTOMPADDING", (0,0),(-1,-1), 4),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
            ("RIGHTPADDING",  (0,0),(-1,-1), 8),
            ("ROWBACKGROUNDS",(0,0),(-1,-1), [colors.white, LIGHT_GRAY]),
        ]))
        story.append(ded_tbl)
        story.append(Spacer(1, 8))

    # ── Summary ────────────────────────────────────────────────────────────────
    adj_total = sum(a.amount if a.adj_type == 'addition' else -a.amount for a in adjustments)
    grand_total = round(subtotal + adj_total, 2)
    payments_total = sum(p.amount for p in (settlement.payments or []))
    balance_due = round(grand_total - payments_total, 2)

    summary_data = [
        [P("Subtotal:", total_s),   P(f"${subtotal:,.2f}", total_r)],
        [P("Grand Total:", total_s), P(f"${grand_total:,.2f}", total_r)],
    ]
    sum_tbl = Table(summary_data, colWidths=[5.5*inch, 1.7*inch])
    sum_tbl.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("LEFTPADDING",   (0,0),(-1,-1), 0),
        ("RIGHTPADDING",  (0,0),(-1,-1), 0),
        ("LINEABOVE",  (0,-1),(-1,-1), 1.2, BLACK),
        ("FONTNAME",   (0,-1),(-1,-1), "Helvetica-Bold"),
    ]))
    story.append(sum_tbl)

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(P("uzLoads TMS and Driver App  •  uzloads.net", footer_s))

    doc.build(story)
    buf.seek(0)
    return buf.read()
