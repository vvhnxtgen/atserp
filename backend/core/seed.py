"""Demo data mirroring the sample set in the single-file HTML app."""
from datetime import date, timedelta

from django.core.files.base import ContentFile
from django.utils import timezone

from .models import (TRF, CustomerPO, Indent, IndentItem, InternalPO,
                     InternalPOItem, Invoice, InvoiceItem, LabSettings,
                     QualityDoc, Quotation, QuotationItem, TestSpec)
from .utils import log


def _f(name, text):
    return ContentFile(text.encode(), name=name)


def seed_demo(actor="Administrator"):
    y = timezone.localdate().year
    s = LabSettings.get()
    eng = (s.engineers or ["Engineer 1"])[0]
    n = timezone.now()

    t1 = TRF.objects.create(
        no=LabSettings.take_number("trf"), date=date(y, 2, 10), priority="Normal",
        created_by="Technician", stage=5,
        customer_company="Deft Dynamics Pvt Ltd", customer_contact="R. Sharma",
        customer_phone="+91 98450 11111", customer_email="qa@deftdyn.in",
        customer_addr="Peenya Industrial Area, Bengaluru", customer_gst="29ABCDE1234F1Z5",
        customer_ref="PO/DD/118",
        sample_desc="Avionics Control Unit", sample_qty="1 No.", sample_part="ACU-450",
        sample_cond="Good",
        alloc_chamber="Humidity Chamber", alloc_date=date(y, 2, 12), alloc_time="10:00",
        alloc_engineer=eng, alloc_by="Administrator", alloc_at=n - timedelta(days=38),
        op_start_date=date(y, 2, 12), op_start_time="10:30",
        op_end_date=date(y, 2, 16), op_end_time="12:30", op_engineer=eng,
        op_obs="No abnormality observed", op_by="Technician", op_at=n - timedelta(days=34),
        result_status="Pass", result_remarks="Meets specification",
        result_by="Technician", result_at=n - timedelta(days=33),
        report_no=f"ATS/RPT/{y}/014", report_date=date(y, 2, 20),
        report_by="Administrator", report_at=n - timedelta(days=30))
    t1.report_file.save("sample-report.txt", _f("sample-report.txt", "Sample test report placeholder."))
    TestSpec.objects.bulk_create([
        TestSpec(trf=t1, test="Damp Heat / Humidity Test", std="IEC 60068-2-78",
                 spec="40 °C / 93% RH", dur="96 h"),
        TestSpec(trf=t1, test="Vibration Test", std="JSS 55555",
                 spec="Random, 10–2000 Hz", dur="2 h/axis")])

    t2 = TRF.objects.create(
        no=LabSettings.take_number("trf"), date=date(y, 5, 4), priority="Urgent",
        created_by="Technician", stage=3,
        customer_company="Trident EMS Systems", customer_contact="K. Iyer",
        customer_phone="+91 90000 22222", customer_email="lab@tridentems.com",
        customer_addr="HITEC City, Hyderabad", customer_gst="36AAACT1234K1Z2",
        sample_desc="Ruggedised Power Supply 28V", sample_qty="2 Nos.", sample_part="RPS-28-M",
        sample_cond="As received", remarks="Handle connectors with care",
        alloc_chamber="Salt Spray Chamber", alloc_date=date(y, 5, 6), alloc_time="09:00",
        alloc_engineer=eng, alloc_by="Administrator", alloc_at=n - timedelta(days=6),
        op_start_date=date(y, 5, 6), op_start_time="09:15", op_engineer=eng,
        op_by="Technician", op_at=n - timedelta(days=5))
    TestSpec.objects.create(trf=t2, test="Salt Spray Test", std="IEC 60068-2-11",
                            spec="5% NaCl, 35 °C", dur="48 h")

    t3 = TRF.objects.create(
        no=LabSettings.take_number("trf"), priority="Normal", created_by="Administrator",
        customer_company="Meghdoot Instruments", customer_contact="P. Rao",
        customer_phone="+91 98111 33333", customer_addr="Balanagar, Hyderabad",
        sample_desc="Field Telemetry Enclosure", sample_qty="1 No.", sample_part="FTE-9",
        sample_cond="Good")
    TestSpec.objects.bulk_create([
        TestSpec(trf=t3, test="IP Test", std="IS/IEC 60529", spec="IP65 verification", dur="—"),
        TestSpec(trf=t3, test="Rain Test", std="JSS 55555", spec="Simulated rain, 4 mm/min", dur="1 h")])

    q1 = Quotation.objects.create(
        no=LabSettings.take_number("qtn"), date=date(y, 1, 20), created_by="Administrator",
        customer_company="Deft Dynamics Pvt Ltd", customer_contact="R. Sharma",
        customer_phone="+91 98450 11111", customer_email="qa@deftdyn.in",
        customer_addr="Peenya Industrial Area, Bengaluru", customer_gst="29ABCDE1234F1Z5",
        subject="Environmental testing of Avionics Control Unit", validity=30, gst_rate=18)
    QuotationItem.objects.bulk_create([
        QuotationItem(quotation=q1, desc="Damp Heat Test — 96 h", qty=1, rate=28000),
        QuotationItem(quotation=q1, desc="Vibration Test — 3 axes", qty=1, rate=36000)])

    po = CustomerPO(no="PO/DD/118", customer="Deft Dynamics Pvt Ltd", date=date(y, 1, 28),
                    amount=75520, quotation=q1, uploaded_by="Administrator")
    po.file.save("sample-po.txt", _f("sample-po.txt", "Sample customer PO placeholder."))

    inv = Invoice.objects.create(
        no=LabSettings.take_number("inv"), date=date(y, 2, 22), trf=t1, trf_no=t1.no,
        po_no="PO/DD/118", customer_company="Deft Dynamics Pvt Ltd",
        customer_gst="29ABCDE1234F1Z5", customer_contact="R. Sharma",
        customer_addr="Peenya Industrial Area, Bengaluru", gst_rate=18,
        status="Paid", created_by="Administrator")
    InvoiceItem.objects.bulk_create([
        InvoiceItem(invoice=inv, desc="Damp Heat / Humidity Test — IEC 60068-2-78 (96 h)",
                    sac="998346", qty=1, rate=28000),
        InvoiceItem(invoice=inv, desc="Vibration Test — JSS 55555", sac="998346", qty=1, rate=36000)])

    ipo = InternalPO.objects.create(
        no=LabSettings.take_number("ipo"), date=date(y, 3, 15), vendor="Sri Sai Lab Supplies",
        vendor_addr="Secunderabad", category="Consumables", gst_rate=18,
        created_by="Administrator")
    InternalPOItem.objects.bulk_create([
        InternalPOItem(po=ipo, desc="NaCl (AR grade) 25 kg", qty=1, rate=6200),
        InternalPOItem(po=ipo, desc="DM water 200 L", qty=1, rate=1800)])

    ind = Indent.objects.create(no=LabSettings.take_number("ind"), raised_by="Technician",
                                priority="Normal")
    IndentItem.objects.bulk_create([
        IndentItem(indent=ind, item="Thermocouple Type-K", qty=4, unit="Nos", purpose="Chamber mapping"),
        IndentItem(indent=ind, item="Nitrile gloves", qty=2, unit="Box", purpose="Sample handling")])

    for cat, title, trf in (("Calibration Report", "Humidity Chamber HC-01 — annual calibration", None),
                            ("Inspection Report", "Incoming inspection — ACU-450", t1),
                            ("NCR", "NCR-03 — RH sensor drift observed during audit", None)):
        d = QualityDoc(category=cat, title=title, trf=trf, trf_no=trf.no if trf else "",
                       uploaded_by="Administrator")
        d.file.save("sample-doc.txt", _f("sample-doc.txt", f"{cat} placeholder."))

    log(actor, "loaded sample data")
    return {"trfs": 3, "quotations": 1, "customer_pos": 1, "invoices": 1,
            "internal_pos": 1, "indents": 1, "quality_docs": 3}
