"""Data model for the Arudhya ERP — mirrors the single-file HTML version."""
from django.contrib.auth.models import AbstractUser
from django.db import models, transaction
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (("admin", "Admin"), ("tech", "Technician"))
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default="tech")

    @property
    def display_name(self):
        return self.get_full_name() or self.username


def default_engineers():
    return ["Engineer 1", "Engineer 2"]


def default_chambers():
    return ["Climatic / Thermal Chamber", "Humidity Chamber", "Walk-in Chamber",
            "Vibration Shaker", "Bump Test Machine", "Drop Test Rig",
            "Dust / Sand Chamber", "Salt Spray Chamber", "Rain / Drip Chamber",
            "Solar Radiation Chamber", "IP / Immersion Test Setup"]


def default_test_types():
    return ["Bump Test", "Drip Test", "Drop Test", "Dust & Sand Test",
            "Fluid Contamination Test", "Damp Heat / Humidity Test", "IP Test",
            "Immersion Test", "Rain Test", "Salt Spray Test", "Sealing Test",
            "Solar Radiation Test", "Vibration Test", "High / Low Temperature Test",
            "Thermal Shock Test"]


INV_TERMS = ("Payment within 15 days of invoice date. Interest @ 18% p.a. applicable "
             "on delayed payments. Subject to Hyderabad jurisdiction.")
QTN_TERMS = ("Prices are exclusive of GST. Testing is subject to chamber availability "
             "at the time of PO. Report will be issued on completion of testing and "
             "receipt of payment unless otherwise agreed.")


class LabSettings(models.Model):
    """Singleton row (pk=1) holding lab profile, notification and numbering config."""
    name = models.CharField(max_length=120, default="Arudhya Test Solutions")
    tag = models.CharField(max_length=200, default="NABL Accredited Laboratory · ISO/IEC 17025:2017")
    addr = models.TextField(default="Hyderabad, Telangana, India", blank=True)
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    gstin = models.CharField(max_length=20, blank=True, default="")

    admin_email = models.EmailField(blank=True, default="")
    admin_whatsapp = models.CharField(max_length=20, blank=True, default="",
                                      help_text="Digits with country code, e.g. 91XXXXXXXXXX")
    email_notifications = models.BooleanField(default=True)

    engineers = models.JSONField(default=default_engineers)
    chambers = models.JSONField(default=default_chambers)
    test_types = models.JSONField(default=default_test_types)

    gst_default = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    bank_name = models.CharField(max_length=120, blank=True, default="")
    bank_account = models.CharField(max_length=40, blank=True, default="")
    bank_ifsc = models.CharField(max_length=20, blank=True, default="")
    bank_branch = models.CharField(max_length=120, blank=True, default="")
    invoice_terms = models.TextField(default=INV_TERMS, blank=True)
    quotation_terms = models.TextField(default=QTN_TERMS, blank=True)

    # Per-document short codes, substituted into the number format as {CODE}
    code_trf = models.CharField(max_length=16, default="TRF")
    code_qtn = models.CharField(max_length=16, default="QTN")
    code_inv = models.CharField(max_length=16, default="INV")
    code_ind = models.CharField(max_length=16, default="IND")
    code_ipo = models.CharField(max_length=16, default="IPO")
    code_dsp = models.CharField(max_length=16, default="DSP")
    code_dch = models.CharField(max_length=16, default="DCH")
    n_trf = models.PositiveIntegerField(default=1)
    n_qtn = models.PositiveIntegerField(default=1)
    n_inv = models.PositiveIntegerField(default=1)
    n_ind = models.PositiveIntegerField(default=1)
    n_ipo = models.PositiveIntegerField(default=1)
    n_dsp = models.PositiveIntegerField(default=1)
    n_dch = models.PositiveIntegerField(default=1)

    # ---- Fully customizable document numbering -------------------------
    # One format string builds every document number. Placeholders:
    #   {ORG}   organisation acronym (num_org below)   e.g. ATS
    #   {CODE}  the per-document code (code_* above)     e.g. INV
    #   {NUM}   the running serial, zero-padded to num_pad width
    #   {YY}    2-digit calendar year        {YYYY} 4-digit year
    #   {FY}    financial year (Apr–Mar)     e.g. 2025-26
    #   {MM}    2-digit month                {DD} 2-digit day
    # Any literal text/separators (/, -, spaces) are kept as typed.
    num_format = models.CharField(max_length=120, default="{ORG}/{CODE}/{FY}/{NUM}")
    num_org = models.CharField(max_length=24, default="ATS")
    num_pad = models.PositiveSmallIntegerField(default=3)
    # yearly_reset: when on, counters restart at 1 each time the year token changes
    yearly_reset = models.BooleanField(default=False)
    # internal marker of the period the counters currently belong to
    num_period = models.CharField(max_length=12, blank=True, default="")

    class Meta:
        verbose_name = "Lab settings"
        verbose_name_plural = "Lab settings"

    def __str__(self):
        return self.name

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    ALL_SERIES = ("trf", "qtn", "inv", "ind", "ipo", "dsp", "dch")

    @staticmethod
    def _fy(d):
        """Indian financial year label for a date, e.g. 2025-26 (Apr–Mar)."""
        y = d.year
        start = y if d.month >= 4 else y - 1
        return f"{start}-{str(start + 1)[-2:]}"

    def _period_key(self) -> str:
        """The token value that drives a yearly reset (FY if the format uses it, else calendar year)."""
        d = timezone.localdate()
        if "{FY}" in (self.num_format or ""):
            return self._fy(d)
        return str(d.year)

    def render_format(self, kind: str, n: int) -> str:
        """Build a document number for a series from the single num_format template."""
        d = timezone.localdate()
        pad = self.num_pad or 3
        code = getattr(self, "code_" + kind, kind.upper())
        repl = {
            "{ORG}": self.num_org or "",
            "{CODE}": code,
            "{NUM}": f"{n:0{pad}d}",
            "{YYYY}": str(d.year),
            "{YY}": f"{d.year % 100:02d}",
            "{FY}": self._fy(d),
            "{MM}": f"{d.month:02d}",
            "{DD}": f"{d.day:02d}",
        }
        out = self.num_format or "{ORG}/{CODE}/{NUM}"
        for k, v in repl.items():
            out = out.replace(k, str(v))
        return out

    # Back-compat alias (older callers used fmt_number)
    def fmt_number(self, kind: str, n: int) -> str:
        return self.render_format(kind, n)

    def peek(self, kind: str) -> str:
        return self.fmt_number(kind, getattr(self, "n_" + kind))

    def _maybe_reset(self, s):
        """If yearly_reset is on and the period changed, zero every counter."""
        if not s.yearly_reset:
            return []
        cur = s._period_key()
        if s.num_period != cur:
            s.num_period = cur
            for k in cls_fields(s):
                setattr(s, "n_" + k, 1)
            return ["num_period"] + [f"n_{k}" for k in cls_fields(s)]
        return []

    @classmethod
    def take_number(cls, kind: str) -> str:
        """Atomically reserve the next document number of the given kind."""
        with transaction.atomic():
            s = cls.objects.select_for_update().get(pk=1)
            reset_fields = s._maybe_reset(s)
            no = s.peek(kind)
            setattr(s, "n_" + kind, getattr(s, "n_" + kind) + 1)
            s.save(update_fields=list(set(reset_fields + ["n_" + kind])))
            return no


def cls_fields(s):
    return LabSettings.ALL_SERIES


class TRF(models.Model):
    """Test Request Form — the number stays fixed from registration to report."""
    PRIORITY = (("Normal", "Normal"), ("Urgent", "Urgent"))
    RESULT = (("Pass", "Pass"), ("Fail", "Fail"))

    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    priority = models.CharField(max_length=10, choices=PRIORITY, default="Normal")
    stage = models.PositiveSmallIntegerField(default=1)  # 1..5
    created_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    customer_company = models.CharField(max_length=160)
    customer_contact = models.CharField(max_length=80, blank=True, default="")
    customer_phone = models.CharField(max_length=40)
    customer_email = models.EmailField(blank=True, default="")
    customer_addr = models.TextField(blank=True, default="")
    customer_gst = models.CharField(max_length=20, blank=True, default="")
    customer_ref = models.CharField(max_length=80, blank=True, default="")

    sample_desc = models.CharField(max_length=200)
    sample_qty = models.CharField(max_length=40, blank=True, default="")
    sample_part = models.CharField(max_length=80, blank=True, default="")
    sample_cond = models.CharField(max_length=120, blank=True, default="")
    batch_no = models.CharField(max_length=60, blank=True, default="")
    remarks = models.TextField(blank=True, default="")

    # Stage 2 — allocation
    alloc_chamber = models.CharField(max_length=120, blank=True, default="")
    alloc_date = models.DateField(null=True, blank=True)
    alloc_time = models.CharField(max_length=10, blank=True, default="")
    alloc_engineer = models.CharField(max_length=80, blank=True, default="")
    alloc_remarks = models.CharField(max_length=200, blank=True, default="")
    alloc_by = models.CharField(max_length=80, blank=True, default="")
    alloc_at = models.DateTimeField(null=True, blank=True)

    # Stage 3 — operation
    op_start_date = models.DateField(null=True, blank=True)
    op_start_time = models.CharField(max_length=10, blank=True, default="")
    op_end_date = models.DateField(null=True, blank=True)
    op_end_time = models.CharField(max_length=10, blank=True, default="")
    op_engineer = models.CharField(max_length=80, blank=True, default="")
    op_obs = models.CharField(max_length=250, blank=True, default="")
    op_start_image = models.FileField(upload_to="test_images/", blank=True, null=True)
    op_end_image = models.FileField(upload_to="test_images/", blank=True, null=True)
    op_by = models.CharField(max_length=80, blank=True, default="")
    op_at = models.DateTimeField(null=True, blank=True)

    # Stage 4 — result
    result_status = models.CharField(max_length=6, choices=RESULT, blank=True, default="")
    result_remarks = models.CharField(max_length=250, blank=True, default="")
    result_by = models.CharField(max_length=80, blank=True, default="")
    result_at = models.DateTimeField(null=True, blank=True)

    # Stage 5 — report
    report_no = models.CharField(max_length=80, blank=True, default="")
    report_date = models.DateField(null=True, blank=True)
    report_file = models.FileField(upload_to="reports/", blank=True, null=True)
    report_by = models.CharField(max_length=80, blank=True, default="")
    report_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.no


class TestSpec(models.Model):
    trf = models.ForeignKey(TRF, related_name="tests", on_delete=models.CASCADE)
    test = models.CharField(max_length=120)
    std = models.CharField(max_length=120, blank=True, default="")
    spec = models.CharField(max_length=250, blank=True, default="")
    dur = models.CharField(max_length=40, blank=True, default="")


class QualityDoc(models.Model):
    CATEGORIES = ["Inspection Report", "Calibration Report", "Monthly Meeting",
                  "Internal Audit Report", "NCR", "Traceability Record",
                  "SOP / Work Instruction", "Training Record", "Other"]
    category = models.CharField(max_length=60)
    title = models.CharField(max_length=200)
    trf = models.ForeignKey(TRF, null=True, blank=True, on_delete=models.SET_NULL, related_name="qdocs")
    trf_no = models.CharField(max_length=60, blank=True, default="")  # snapshot for traceability
    doc_date = models.DateField(default=timezone.localdate)
    file = models.FileField(upload_to="quality/")
    uploaded_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Quotation(models.Model):
    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    customer_company = models.CharField(max_length=160)
    customer_contact = models.CharField(max_length=80, blank=True, default="")
    customer_phone = models.CharField(max_length=40, blank=True, default="")
    customer_email = models.EmailField(blank=True, default="")
    customer_addr = models.TextField(blank=True, default="")
    customer_gst = models.CharField(max_length=20, blank=True, default="")
    subject = models.CharField(max_length=250, blank=True, default="")
    validity = models.PositiveIntegerField(default=30)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    notes = models.TextField(blank=True, default="")
    created_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def sub(self):
        return sum((i.qty * i.rate for i in self.items.all()), start=0)

    @property
    def gst_amount(self):
        return self.sub * self.gst_rate / 100

    @property
    def total(self):
        return self.sub + self.gst_amount


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, related_name="items", on_delete=models.CASCADE)
    desc = models.CharField(max_length=250)
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class CustomerPO(models.Model):
    no = models.CharField(max_length=80)
    customer = models.CharField(max_length=160)
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    quotation = models.ForeignKey(Quotation, null=True, blank=True, on_delete=models.SET_NULL, related_name="pos")
    file = models.FileField(upload_to="customer_pos/")
    uploaded_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Indent(models.Model):
    STATUS = (("Pending", "Pending"), ("Approved", "Approved"), ("Rejected", "Rejected"))
    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    raised_by = models.CharField(max_length=80, blank=True, default="")
    priority = models.CharField(max_length=10, choices=TRF.PRIORITY, default="Normal")
    need_by = models.DateField(null=True, blank=True)
    remarks = models.CharField(max_length=250, blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS, default="Pending")
    decided_by = models.CharField(max_length=80, blank=True, default="")
    decided_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=250, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class IndentItem(models.Model):
    indent = models.ForeignKey(Indent, related_name="items", on_delete=models.CASCADE)
    item = models.CharField(max_length=160)
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit = models.CharField(max_length=30, blank=True, default="")
    purpose = models.CharField(max_length=200, blank=True, default="")


class Invoice(models.Model):
    STATUS = (("Unpaid", "Unpaid"), ("Paid", "Paid"))
    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    trf = models.ForeignKey(TRF, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    trf_no = models.CharField(max_length=60)  # snapshot — traceability survives TRF deletion
    po_no = models.CharField(max_length=80, blank=True, default="")
    customer_company = models.CharField(max_length=160)
    customer_gst = models.CharField(max_length=20, blank=True, default="")
    customer_contact = models.CharField(max_length=80, blank=True, default="")
    customer_addr = models.TextField(blank=True, default="")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    notes = models.CharField(max_length=250, blank=True, default="")
    status = models.CharField(max_length=8, choices=STATUS, default="Unpaid")
    created_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def sub(self):
        return sum((i.qty * i.rate for i in self.items.all()), start=0)

    @property
    def gst_amount(self):
        return self.sub * self.gst_rate / 100

    @property
    def total(self):
        return self.sub + self.gst_amount


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, related_name="items", on_delete=models.CASCADE)
    desc = models.CharField(max_length=250)
    sac = models.CharField(max_length=20, blank=True, default="998346")
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class InternalPO(models.Model):
    CATEGORIES = (("Consumables", "Consumables"), ("Tools & Maintenance", "Tools & Maintenance"),
                  ("Calibration Services", "Calibration Services"), ("Office / Admin", "Office / Admin"),
                  ("Other", "Other"))
    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    vendor = models.CharField(max_length=160)
    vendor_addr = models.TextField(blank=True, default="")
    category = models.CharField(max_length=30, choices=CATEGORIES, default="Consumables")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18)
    notes = models.CharField(max_length=250, blank=True, default="")
    created_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def sub(self):
        return sum((i.qty * i.rate for i in self.items.all()), start=0)

    @property
    def gst_amount(self):
        return self.sub * self.gst_rate / 100

    @property
    def total(self):
        return self.sub + self.gst_amount


class InternalPOItem(models.Model):
    po = models.ForeignKey(InternalPO, related_name="items", on_delete=models.CASCADE)
    desc = models.CharField(max_length=250)
    qty = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)


class Activity(models.Model):
    user = models.CharField(max_length=80, blank=True, default="")
    text = models.CharField(max_length=300)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]
        verbose_name_plural = "Activity"


class Witness(models.Model):
    """Test witness attached to a TRF (name / designation / organization)."""
    trf = models.ForeignKey(TRF, related_name="witnesses", on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    designation = models.CharField(max_length=120, blank=True, default="")
    organization = models.CharField(max_length=160, blank=True, default="")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.trf.no})"


class Equipment(models.Model):
    STATUS = (("Active", "Active"), ("Calibration Due", "Calibration Due"),
              ("Under Maintenance", "Under Maintenance"), ("Retired", "Retired"))
    name = models.CharField(max_length=160)
    equipment_id = models.CharField(max_length=60, blank=True, default="")
    range_spec = models.CharField(max_length=200, blank=True, default="")
    manufacturer = models.CharField(max_length=120, blank=True, default="")
    model = models.CharField(max_length=120, blank=True, default="")
    serial_no = models.CharField(max_length=120, blank=True, default="")
    location = models.CharField(max_length=120, blank=True, default="")
    calib_details = models.CharField(max_length=250, blank=True, default="")
    calib_due = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS, default="Active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Equipment"

    def __str__(self):
        return self.name


class CalibrationCert(models.Model):
    equipment = models.ForeignKey(Equipment, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name="certs")
    equipment_name = models.CharField(max_length=160, blank=True, default="")  # snapshot
    cert_no = models.CharField(max_length=80)
    calib_date = models.DateField(default=timezone.localdate)
    expiry_date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to="calibration/")
    uploaded_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class LabReport(models.Model):
    """Standalone register of completed laboratory reports (PDF uploads)."""
    trf = models.ForeignKey(TRF, null=True, blank=True, on_delete=models.SET_NULL,
                            related_name="lab_reports")
    trf_no = models.CharField(max_length=60, blank=True, default="")  # snapshot
    client_name = models.CharField(max_length=160, blank=True, default="")
    report_no = models.CharField(max_length=80)
    report_date = models.DateField(default=timezone.localdate)
    file = models.FileField(upload_to="lab_reports/")
    uploaded_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Dispatch(models.Model):
    STATUS = (("Pending", "Pending"), ("Dispatched", "Dispatched"), ("Delivered", "Delivered"))
    no = models.CharField(max_length=60, unique=True)
    trf = models.ForeignKey(TRF, null=True, blank=True, on_delete=models.SET_NULL,
                            related_name="dispatches")
    trf_no = models.CharField(max_length=60, blank=True, default="")
    client_name = models.CharField(max_length=160)
    courier_name = models.CharField(max_length=120, blank=True, default="")
    tracking_no = models.CharField(max_length=120, blank=True, default="")
    dispatch_date = models.DateField(default=timezone.localdate)
    sent_by = models.CharField(max_length=80, blank=True, default="")
    status = models.CharField(max_length=12, choices=STATUS, default="Pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Dispatches"


class Challan(models.Model):
    no = models.CharField(max_length=60, unique=True)
    date = models.DateField(default=timezone.localdate)
    client_name = models.CharField(max_length=160)
    address = models.TextField(blank=True, default="")
    trf = models.ForeignKey(TRF, null=True, blank=True, on_delete=models.SET_NULL,
                            related_name="challans")
    trf_no = models.CharField(max_length=60, blank=True, default="")
    report_no = models.CharField(max_length=80, blank=True, default="")
    copies = models.PositiveIntegerField(default=1)
    courier = models.CharField(max_length=160, blank=True, default="")
    client_gst = models.CharField(max_length=40, blank=True, default="")
    inv_ref = models.CharField(max_length=120, blank=True, default="")     # Inv No./Date
    other_info = models.CharField(max_length=200, blank=True, default="")  # Any other Inf.
    po_no = models.CharField(max_length=80, blank=True, default="")
    po_date = models.DateField(null=True, blank=True)
    purpose = models.CharField(max_length=40, blank=True, default="Sub-contracting")
    created_by = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ChallanItem(models.Model):
    challan = models.ForeignKey(Challan, related_name="items", on_delete=models.CASCADE)
    item = models.CharField(max_length=200)
    qty = models.CharField(max_length=40, blank=True, default="")
    remarks = models.CharField(max_length=200, blank=True, default="")


# GST state-code → state name (for parsing GSTIN when a customer isn't on file yet)
GST_STATES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar",
    "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}


class Customer(models.Model):
    """Directory of customers, keyed by GSTIN, for auto-fill on new TRFs.

    A row is created/updated automatically whenever a TRF is registered with a
    GSTIN, so the lab gradually builds its own customer master with no extra work.
    """
    gstin = models.CharField(max_length=20, unique=True)
    company = models.CharField(max_length=160)
    contact = models.CharField(max_length=80, blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    state = models.CharField(max_length=60, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company"]

    def __str__(self):
        return f"{self.company} ({self.gstin})"

    @staticmethod
    def norm_gst(g: str) -> str:
        return "".join(ch for ch in (g or "").upper() if ch.isalnum())

    @classmethod
    def state_for(cls, gstin: str) -> str:
        g = cls.norm_gst(gstin)
        return GST_STATES.get(g[:2], "") if len(g) >= 2 else ""

    @classmethod
    def upsert_from_trf(cls, trf):
        """Create or refresh a directory entry from a TRF's customer fields."""
        g = cls.norm_gst(trf.customer_gst)
        if len(g) < 15:                      # only store proper 15-char GSTINs
            return None
        obj, _ = cls.objects.update_or_create(
            gstin=g,
            defaults=dict(
                company=trf.customer_company or "",
                contact=trf.customer_contact or "",
                phone=trf.customer_phone or "",
                email=trf.customer_email or "",
                address=trf.customer_addr or "",
                state=cls.state_for(g),
            ),
        )
        return obj
