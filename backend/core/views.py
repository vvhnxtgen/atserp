"""API views: auth, settings, TRF lifecycle actions, registers and dashboards."""
import calendar
from datetime import date

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (TRF, Activity, CalibrationCert, Challan, Customer, CustomerPO,
                     Dispatch, Equipment, Indent, InternalPO, Invoice,
                     LabReport, LabSettings, QualityDoc, Quotation, User,
                     Witness)
from .permissions import IsAdminRole
from .serializers import (ActivitySerializer, CalibrationCertSerializer,
                          CustomerSerializer,
                          ChallanSerializer, CustomerPOSerializer,
                          DispatchSerializer, EquipmentSerializer,
                          IndentSerializer, InternalPOSerializer,
                          InvoiceSerializer, LabReportSerializer,
                          QualityDocSerializer, QuotationSerializer,
                          SettingsSerializer, TRFListSerializer,
                          TRFSerializer, UserSerializer, WitnessSerializer)
from .utils import log, notify_admin


# ---------------------------------------------------------------- auth ----
class LoginView(ObtainAuthToken):
    permission_classes = []

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        log(user.display_name, "signed in")
        return Response({"token": token.key, "user": UserSerializer(user).data})


class LogoutView(APIView):
    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"ok": True})


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class PasswordsView(APIView):
    """Admin sets new passwords for the admin/tech logins (parity with the HTML app)."""
    permission_classes = [IsAdminRole]

    def put(self, request):
        changed = []
        for username, key in (("admin", "admin_password"), ("tech", "tech_password")):
            pw = request.data.get(key) or ""
            if pw:
                if len(pw) < 6:
                    return Response({"detail": f"{username} password must be at least 6 characters."},
                                    status=400)
                u = User.objects.filter(username=username).first()
                if u:
                    u.set_password(pw)
                    u.save()
                    Token.objects.filter(user=u).exclude(user=request.user).delete()
                    changed.append(username)
        if not changed:
            return Response({"detail": "Enter a new password to update."}, status=400)
        log(request.user.display_name, "updated login passwords")
        return Response({"changed": changed})


# ------------------------------------------------------------ settings ----
class SettingsView(APIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        return Response(SettingsSerializer(LabSettings.get()).data)

    def put(self, request):
        s = SettingsSerializer(LabSettings.get(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        log(request.user.display_name, "updated lab settings")
        return Response(s.data)


# ----------------------------------------------------------------- TRF ----
class TRFViewSet(viewsets.ModelViewSet):
    queryset = TRF.objects.prefetch_related("tests").all()
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        return TRFListSerializer if self.action == "list" else TRFSerializer

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        trf = serializer.save()
        Customer.upsert_from_trf(trf)          # learn/refresh customer master by GSTIN
        log(self.request.user.display_name, f"registered TRF {trf.no} for {trf.customer_company}")
        self._email = notify_admin(
            f"New TRF Registered — {trf.no}",
            [f"Customer: {trf.customer_company}", f"Sample: {trf.sample_desc}",
             "Tests: " + ", ".join(t.test for t in trf.tests.all()),
             f"Priority: {trf.priority}"],
            actor=self.request.user.display_name)

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        n = getattr(self, "_email", {"email": "skipped", "whatsapp": "skipped", "wa_link": ""})
        resp.data["notify"] = n
        resp.data["email"] = n["email"] if isinstance(n, dict) else n
        return resp

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted TRF {instance.no}")
        instance.delete()

    def _full(self, trf, notify):
        d = TRFSerializer(trf, context={"request": self.request}).data
        if isinstance(notify, dict):
            d["notify"] = notify
            d["email"] = notify.get("email", "skipped")
        else:
            d["notify"] = {"email": notify, "whatsapp": "skipped", "wa_link": ""}
            d["email"] = notify
        return Response(d)

    @action(detail=True, methods=["post"])
    def allocate(self, request, pk=None):
        trf = self.get_object()
        d = request.data
        if not (d.get("alloc_chamber") and d.get("alloc_date") and d.get("alloc_engineer")):
            return Response({"detail": "Chamber, Date and Engineer are required."}, status=400)
        for f in ("alloc_chamber", "alloc_date", "alloc_time", "alloc_engineer", "alloc_remarks"):
            setattr(trf, f, d.get(f, "") or ("" if f != "alloc_date" else None))
        trf.alloc_by = request.user.display_name
        trf.alloc_at = timezone.now()
        trf.stage = max(trf.stage, 2)
        trf.save()
        log(trf.alloc_by, f"allocated {trf.no} → {trf.alloc_chamber}")
        email = notify_admin(f"Chamber Allocated — {trf.no}",
                             [f"Chamber: {trf.alloc_chamber}",
                              f"Scheduled: {trf.alloc_date} {trf.alloc_time}",
                              f"Engineer: {trf.alloc_engineer}",
                              f"Customer: {trf.customer_company}"],
                             actor=trf.alloc_by)
        return self._full(trf, email)

    @action(detail=True, methods=["post"])
    def operate(self, request, pk=None):
        trf = self.get_object()
        if not trf.alloc_chamber:
            return Response({"detail": "Complete chamber allocation first."}, status=400)
        d = request.data
        if not (d.get("op_start_date") and d.get("op_start_time") and d.get("op_engineer")):
            return Response({"detail": "Start date, start time and Engineer are required."}, status=400)
        if d.get("op_end_date") and not d.get("op_end_time"):
            return Response({"detail": "Add the end time along with the end date."}, status=400)
        new_start = not trf.op_start_date
        new_end = bool(d.get("op_end_date")) and not trf.op_end_date
        trf.op_start_date = d["op_start_date"]
        trf.op_start_time = d["op_start_time"]
        trf.op_end_date = d.get("op_end_date") or None
        trf.op_end_time = d.get("op_end_time", "")
        trf.op_engineer = d["op_engineer"]
        trf.op_obs = d.get("op_obs", "")
        trf.op_by = request.user.display_name
        trf.op_at = timezone.now()
        trf.stage = max(trf.stage, 3)
        trf.save()
        email = "skipped"
        if new_end:
            log(trf.op_by, f"completed test on {trf.no}")
            email = notify_admin(f"Test Completed — {trf.no}",
                                 [f"Start: {trf.op_start_date} {trf.op_start_time}",
                                  f"End: {trf.op_end_date} {trf.op_end_time}",
                                  f"Engineer: {trf.op_engineer}",
                                  f"Customer: {trf.customer_company}"], actor=trf.op_by)
        elif new_start:
            log(trf.op_by, f"started test on {trf.no}")
            email = notify_admin(f"Test Started — {trf.no}",
                                 [f"Start: {trf.op_start_date} {trf.op_start_time}",
                                  f"Engineer: {trf.op_engineer}",
                                  f"Chamber: {trf.alloc_chamber}",
                                  f"Customer: {trf.customer_company}"], actor=trf.op_by)
        else:
            log(trf.op_by, f"updated operation for {trf.no}")
        return self._full(trf, email)

    @action(detail=True, methods=["post"])
    def result(self, request, pk=None):
        trf = self.get_object()
        if not trf.op_end_date:
            return Response({"detail": "Record the test end date & time first."}, status=400)
        st = request.data.get("result_status")
        if st not in ("Pass", "Fail"):
            return Response({"detail": "Result must be Pass or Fail."}, status=400)
        trf.result_status = st
        trf.result_remarks = request.data.get("result_remarks", "")
        trf.result_by = request.user.display_name
        trf.result_at = timezone.now()
        trf.stage = max(trf.stage, 4)
        trf.save()
        log(trf.result_by, f"recorded result {st.upper()} for {trf.no}")
        email = notify_admin(f"Result Recorded — {trf.no} : {st.upper()}",
                             [f"Customer: {trf.customer_company}",
                              f"Sample: {trf.sample_desc}",
                              f"Remarks: {trf.result_remarks}" if trf.result_remarks else ""],
                             actor=trf.result_by)
        return self._full(trf, email)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def report(self, request, pk=None):
        trf = self.get_object()
        if trf.stage < 4:
            return Response({"detail": "Record results before uploading the report."}, status=400)
        f = request.FILES.get("report_file")
        if not f:
            return Response({"detail": "Attach the report file."}, status=400)
        trf.report_file = f
        trf.report_no = request.data.get("report_no", "")
        trf.report_date = request.data.get("report_date") or timezone.localdate()
        trf.report_by = request.user.display_name
        trf.report_at = timezone.now()
        trf.stage = 5
        trf.save()
        log(trf.report_by, f"uploaded final report for {trf.no}")
        email = notify_admin(f"Final Report Uploaded — {trf.no}",
                             [f"Report No: {trf.report_no or '—'}",
                              f"Result: {trf.result_status.upper() if trf.result_status else '—'}",
                              f"Customer: {trf.customer_company}",
                              "TRF lifecycle complete."], actor=trf.report_by)
        return self._full(trf, email)


    @action(detail=True, methods=["post"], url_path="start-test")
    def start_test(self, request, pk=None):
        """One-click start: stamps current time + technician name."""
        trf = self.get_object()
        if not trf.alloc_chamber:
            return Response({"detail": "Complete chamber allocation first."}, status=400)
        if trf.op_start_date:
            return Response({"detail": "Test already started."}, status=400)
        now = timezone.localtime()
        trf.op_start_date = now.date()
        trf.op_start_time = now.strftime("%H:%M")
        trf.op_engineer = request.user.display_name
        trf.op_by = request.user.display_name
        trf.op_at = timezone.now()
        trf.stage = max(trf.stage, 3)
        trf.save()
        log(trf.op_by, f"started test on {trf.no}")
        email = notify_admin(f"Test Started — {trf.no}",
                             [f"Start: {trf.op_start_date} {trf.op_start_time}",
                              f"Technician: {trf.op_engineer}",
                              f"Chamber: {trf.alloc_chamber}",
                              f"Customer: {trf.customer_company}"], actor=trf.op_by)
        return self._full(trf, email)

    @action(detail=True, methods=["post"], url_path="upload-image",
            parser_classes=[MultiPartParser, FormParser])
    def upload_image(self, request, pk=None):
        """Attach the starting / ending test photo (JPG / JPEG / PNG)."""
        trf = self.get_object()
        kind = request.data.get("kind")
        f = request.FILES.get("image")
        if kind not in ("start", "end"):
            return Response({"detail": "kind must be 'start' or 'end'."}, status=400)
        if not f:
            return Response({"detail": "Attach an image file."}, status=400)
        name = (f.name or "").lower()
        if not name.endswith((".jpg", ".jpeg", ".png")):
            return Response({"detail": "Only JPG, JPEG or PNG images are supported."}, status=400)
        if not trf.op_start_date:
            return Response({"detail": "Start the test before capturing images."}, status=400)
        if kind == "start":
            trf.op_start_image = f
        else:
            trf.op_end_image = f
        trf.save()
        log(request.user.display_name, f"uploaded {kind}ing test image for {trf.no}")
        return self._full(trf, "skipped")

    @action(detail=True, methods=["post"], url_path="complete-test")
    def complete_test(self, request, pk=None):
        """One-click completion: stamps end time, status and completed-by."""
        trf = self.get_object()
        if not trf.op_start_date:
            return Response({"detail": "Start the test first."}, status=400)
        if trf.op_end_date:
            return Response({"detail": "Test already completed."}, status=400)
        now = timezone.localtime()
        trf.op_end_date = now.date()
        trf.op_end_time = now.strftime("%H:%M")
        if request.data.get("op_obs"):
            trf.op_obs = request.data["op_obs"]
        trf.op_by = request.user.display_name
        trf.op_at = timezone.now()
        trf.stage = max(trf.stage, 3)
        trf.save()
        log(trf.op_by, f"completed test on {trf.no}")
        email = notify_admin(f"Test Completed — {trf.no}",
                             [f"Start: {trf.op_start_date} {trf.op_start_time}",
                              f"End: {trf.op_end_date} {trf.op_end_time}",
                              f"Completed by: {trf.op_by}",
                              f"Customer: {trf.customer_company}"], actor=trf.op_by)
        return self._full(trf, email)


# ------------------------------------------------------------- quality ----
class QualityDocViewSet(viewsets.ModelViewSet):
    queryset = QualityDoc.objects.all()
    serializer_class = QualityDocSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action == "destroy":
            return [IsAdminRole()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("category"):
            qs = qs.filter(category=p["category"])
        if p.get("trf"):
            qs = qs.filter(trf_id=p["trf"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(models_q(q))
        return qs

    def perform_create(self, serializer):
        doc = serializer.save()
        log(self.request.user.display_name, f"uploaded quality doc: {doc.category} — {doc.title}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted quality doc {instance.title}")
        instance.delete()


def models_q(q):
    from django.db.models import Q
    return Q(title__icontains=q) | Q(trf_no__icontains=q) | Q(category__icontains=q)


class TraceView(APIView):
    """Traceability matrix: full audit context for every TRF."""

    def get(self, request):
        rows = []
        docs_by_trf, inv_by_trf, wit_by_trf = {}, {}, {}
        for d in QualityDoc.objects.exclude(trf=None).values("trf_id", "category"):
            docs_by_trf.setdefault(d["trf_id"], []).append(d["category"])
        for i in Invoice.objects.exclude(trf=None).values("trf_id", "no"):
            inv_by_trf.setdefault(i["trf_id"], []).append(i["no"])
        for w in Witness.objects.values("trf_id", "name"):
            wit_by_trf.setdefault(w["trf_id"], []).append(w["name"])
        eq_by_name = {e.name.strip().lower(): e for e in Equipment.objects.all()}
        for t in TRF.objects.prefetch_related("tests"):
            eq = eq_by_name.get((t.alloc_chamber or "").strip().lower())
            methods = [x.std or x.test for x in t.tests.all()]
            rows.append({
                "id": t.id, "no": t.no, "customer": t.customer_company,
                "sample_id": t.sample_part or t.sample_desc,
                "batch": t.batch_no,
                "technician": t.op_engineer or t.created_by,
                "method": ", ".join(m for m in methods if m),
                "instrument": t.alloc_chamber,
                "calib_status": eq.status if eq else "",
                "calib_due": eq.calib_due if eq else None,
                "registered": t.date, "allocated": t.alloc_date,
                "op_start": t.op_start_date, "op_start_time": t.op_start_time,
                "op_end": t.op_end_date, "op_end_time": t.op_end_time,
                "witnesses": wit_by_trf.get(t.id, []),
                "start_image": t.op_start_image.url if t.op_start_image else "",
                "end_image": t.op_end_image.url if t.op_end_image else "",
                "result": t.result_status,
                "report_url": t.report_file.url if t.report_file else "",
                "doc_cats": docs_by_trf.get(t.id, []),
                "invoices": inv_by_trf.get(t.id, []),
            })
        return Response(rows)


# ------------------------------------------------------------ business ----
class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.prefetch_related("items", "pos").all()
    serializer_class = QuotationSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        q = serializer.save()
        log(self.request.user.display_name, f"created quotation {q.no} for {q.customer_company}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted quotation {instance.no}")
        instance.delete()


class CustomerPOViewSet(viewsets.ModelViewSet):
    queryset = CustomerPO.objects.select_related("quotation").all()
    serializer_class = CustomerPOSerializer
    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        po = serializer.save()
        log(self.request.user.display_name, f"uploaded customer PO {po.no} from {po.customer}")
        self._email = notify_admin(f"Customer PO Received — {po.no}",
                                   [f"Customer: {po.customer}",
                                    f"Value: {po.amount or '—'}",
                                    f"Against quotation: {po.quotation.no}" if po.quotation else ""],
                                   actor=self.request.user.display_name)

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        n = getattr(self, "_email", {"email": "skipped", "whatsapp": "skipped", "wa_link": ""})
        resp.data["notify"] = n
        resp.data["email"] = n["email"] if isinstance(n, dict) else n
        return resp


class IndentViewSet(viewsets.ModelViewSet):
    queryset = Indent.objects.prefetch_related("items").all()
    serializer_class = IndentSerializer

    def get_permissions(self):
        if self.action in ("approve", "reject", "destroy"):
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        ind = serializer.save()
        log(ind.raised_by, f"raised indent {ind.no} ({ind.items.count()} items)")
        summary = ", ".join(f"{i.item} ×{i.qty:g}" for i in ind.items.all())
        self._email = notify_admin(f"Indent Raised — {ind.no} ({ind.priority})",
                                   [f"Items: {summary}",
                                    f"Needed by: {ind.need_by}" if ind.need_by else "",
                                    f"Raised by: {ind.raised_by}",
                                    f"Remarks: {ind.remarks}" if ind.remarks else "",
                                    "Action: approval pending in Business → Indents."],
                                   actor=ind.raised_by)

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        n = getattr(self, "_email", {"email": "skipped", "whatsapp": "skipped", "wa_link": ""})
        resp.data["notify"] = n
        resp.data["email"] = n["email"] if isinstance(n, dict) else n
        return resp

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        ind = self.get_object()
        ind.status, ind.decided_by, ind.decided_at, ind.note = "Approved", request.user.display_name, timezone.now(), ""
        ind.save()
        log(ind.decided_by, f"approved indent {ind.no}")
        return Response(IndentSerializer(ind).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        ind = self.get_object()
        ind.status, ind.decided_by, ind.decided_at = "Rejected", request.user.display_name, timezone.now()
        ind.note = request.data.get("note", "")
        ind.save()
        log(ind.decided_by, f"rejected indent {ind.no}")
        return Response(IndentSerializer(ind).data)


# ------------------------------------------------------------ accounts ----
class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.prefetch_related("items").all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        inv = serializer.save()
        log(self.request.user.display_name, f"raised invoice {inv.no} against {inv.trf_no}")
        self._email = notify_admin(f"Invoice Raised — {inv.no}",
                                   [f"Against TRF: {inv.trf_no}",
                                    f"Customer: {inv.customer_company}",
                                    f"Amount: ₹ {inv.total:,.2f}"],
                                   actor=self.request.user.display_name)

    def create(self, request, *args, **kwargs):
        resp = super().create(request, *args, **kwargs)
        n = getattr(self, "_email", {"email": "skipped", "whatsapp": "skipped", "wa_link": ""})
        resp.data["notify"] = n
        resp.data["email"] = n["email"] if isinstance(n, dict) else n
        return resp

    @action(detail=True, methods=["post"], url_path="toggle-paid")
    def toggle_paid(self, request, pk=None):
        inv = self.get_object()
        inv.status = "Paid" if inv.status == "Unpaid" else "Unpaid"
        inv.save(update_fields=["status"])
        log(request.user.display_name, f"marked invoice {inv.no} as {inv.status}")
        return Response(InvoiceSerializer(inv).data)

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted invoice {instance.no}")
        instance.delete()


class InternalPOViewSet(viewsets.ModelViewSet):
    queryset = InternalPO.objects.prefetch_related("items").all()
    serializer_class = InternalPOSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        po = serializer.save()
        log(self.request.user.display_name, f"issued internal PO {po.no} to {po.vendor}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted internal PO {instance.no}")
        instance.delete()


# ----------------------------------------------------------- dashboard ----
class DashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        trfs = list(TRF.objects.all())
        pipeline = [0] * 6
        for t in trfs:
            pipeline[t.stage] += 1
        month_inv = [i for i in Invoice.objects.prefetch_related("items")
                     if i.date.year == today.year and i.date.month == today.month]
        receivables = sum((i.total for i in Invoice.objects.filter(status="Unpaid").prefetch_related("items")), start=0)
        pending = Indent.objects.filter(status="Pending").prefetch_related("items")
        awaiting = TRF.objects.filter(stage__lt=5).order_by("created_at")[:5]
        return Response({
            "cards": {
                "active_trfs": sum(1 for t in trfs if t.stage < 5),
                "in_operation": pipeline[3],
                "reports_month": sum(1 for t in trfs if t.stage == 5 and t.report_date and
                                     t.report_date.year == today.year and t.report_date.month == today.month),
                "pending_indents": pending.count(),
                "revenue_month": sum((i.total for i in month_inv), start=0),
                "receivables": receivables,
            },
            "pipeline": pipeline[1:6],
            "total_trfs": len(trfs),
            "activity": ActivitySerializer(Activity.objects.all()[:14], many=True).data,
            "pending_indents": IndentSerializer(pending[:5], many=True).data,
            "awaiting_trfs": TRFListSerializer(awaiting, many=True).data,
        })


class FinanceView(APIView):
    permission_classes = [IsAdminRole]

    @staticmethod
    def _key(d: date, mode: str):
        if mode == "FY":
            return (d.year if d.month >= 4 else d.year - 1), (d.month + 8) % 12
        return d.year, d.month - 1

    def get(self, request):
        mode = request.query_params.get("mode", "CY")
        invoices = list(Invoice.objects.prefetch_related("items"))
        ipos = list(InternalPO.objects.prefetch_related("items"))
        years = sorted({self._key(x.date, mode)[0] for x in invoices + ipos} |
                       {self._key(timezone.localdate(), mode)[0]}, reverse=True)
        try:
            year = int(request.query_params.get("year", years[0]))
        except (TypeError, ValueError):
            year = years[0]
        rev, sp = [0.0] * 12, [0.0] * 12
        for i in invoices:
            y, idx = self._key(i.date, mode)
            if y == year:
                rev[idx] += float(i.total)
        for p in ipos:
            y, idx = self._key(p.date, mode)
            if y == year:
                sp[idx] += float(p.total)
        labels = (["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
                  if mode == "FY" else list(calendar.month_abbr)[1:])
        inv_count = sum(1 for i in invoices if self._key(i.date, mode)[0] == year)
        recv = sum(float(i.total) for i in invoices
                   if i.status != "Paid" and self._key(i.date, mode)[0] == year)
        year_rows = []
        for y in years:
            r = sum(float(i.total) for i in invoices if self._key(i.date, mode)[0] == y)
            s = sum(float(p.total) for p in ipos if self._key(p.date, mode)[0] == y)
            year_rows.append({"year": y, "revenue": r, "spend": s, "net": r - s})
        return Response({"mode": mode, "year": year, "years": years, "labels": labels,
                         "revenue": rev, "spend": sp,
                         "cards": {"revenue": sum(rev), "spend": sum(sp),
                                   "net": sum(rev) - sum(sp),
                                   "invoices": inv_count, "receivables": recv},
                         "year_rows": year_rows})


class SeedDemoView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        from .seed import seed_demo
        created = seed_demo(actor=request.user.display_name)
        return Response({"ok": True, "created": created})


# ------------------------------------------------------- lab registers ----
class WitnessViewSet(viewsets.ModelViewSet):
    queryset = Witness.objects.all()
    serializer_class = WitnessSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trf = self.request.query_params.get("trf")
        return qs.filter(trf_id=trf) if trf else qs


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer

    def perform_create(self, serializer):
        eq = serializer.save()
        log(self.request.user.display_name, f"added equipment: {eq.name}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted equipment: {instance.name}")
        instance.delete()


class CalibrationCertViewSet(viewsets.ModelViewSet):
    queryset = CalibrationCert.objects.select_related("equipment").all()
    serializer_class = CalibrationCertSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        eq = self.request.query_params.get("equipment")
        return qs.filter(equipment_id=eq) if eq else qs

    def perform_create(self, serializer):
        c = serializer.save()
        log(self.request.user.display_name, f"uploaded calibration certificate {c.cert_no} ({c.equipment_name})")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted calibration certificate {instance.cert_no}")
        instance.delete()


class LabReportViewSet(viewsets.ModelViewSet):
    queryset = LabReport.objects.all()
    serializer_class = LabReportSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from django.db.models import Q
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get("trf"):
            qs = qs.filter(trf_id=p["trf"])
        if p.get("q"):
            q = p["q"]
            qs = qs.filter(Q(trf_no__icontains=q) | Q(client_name__icontains=q) |
                           Q(report_no__icontains=q))
        return qs

    def perform_create(self, serializer):
        r = serializer.save()
        log(self.request.user.display_name, f"uploaded lab report {r.report_no}" +
            (f" (TRF {r.trf_no})" if r.trf_no else ""))

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted lab report {instance.report_no}")
        instance.delete()


class DispatchViewSet(viewsets.ModelViewSet):
    queryset = Dispatch.objects.all()
    serializer_class = DispatchSerializer

    def perform_create(self, serializer):
        d = serializer.save()
        log(self.request.user.display_name, f"created dispatch {d.no} → {d.client_name}")

    def perform_update(self, serializer):
        before = serializer.instance.status
        d = serializer.save()
        if d.status != before:
            log(self.request.user.display_name, f"dispatch {d.no} marked {d.status}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted dispatch {instance.no}")
        instance.delete()


class CustomerViewSet(viewsets.ReadOnlyModelViewSet):
    """Customer directory — list/search, plus lookup-by-GST for auto-fill."""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_queryset(self):
        from django.db.models import Q
        qs = super().get_queryset()
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(company__icontains=q) | Q(gstin__icontains=q))
        return qs

    @action(detail=False, methods=["get"], url_path="by-gst")
    def by_gst(self, request):
        """Return a saved customer for a GSTIN, plus the parsed state either way.

        Response: {"found": bool, "state": str, "customer": {..}|null}
        The frontend uses this to auto-fill the TRF customer block.
        """
        g = Customer.norm_gst(request.query_params.get("gstin", ""))
        state = Customer.state_for(g)
        obj = Customer.objects.filter(gstin=g).first() if len(g) >= 15 else None
        return Response({
            "found": bool(obj),
            "state": state,
            "customer": CustomerSerializer(obj).data if obj else None,
        })


class NumberingPreviewView(APIView):
    """Live preview of how each document number will look with a given format.

    POST body may include any of: num_format, num_org, num_pad, and codes
    {code_trf: "TRF", ...}. Missing keys fall back to saved settings. Returns a
    sample number per series without consuming any counter.
    """
    def post(self, request):
        s = LabSettings.get()
        d = timezone.localdate()
        fy_y = d.year if d.month >= 4 else d.year - 1
        fy = f"{fy_y}-{str(fy_y+1)[-2:]}"
        fmt = request.data.get("num_format", s.num_format) or "{ORG}/{CODE}/{NUM}"
        org = request.data.get("num_org", s.num_org)
        pad = int(request.data.get("num_pad") or s.num_pad or 3)
        codes = request.data.get("codes", {}) or {}
        out = {}
        for k in LabSettings.ALL_SERIES:
            code = codes.get("code_" + k, getattr(s, "code_" + k))
            n = getattr(s, "n_" + k)
            repl = {"{ORG}": org or "", "{CODE}": code, "{NUM}": f"{n:0{pad}d}",
                    "{YYYY}": str(d.year), "{YY}": f"{d.year%100:02d}", "{FY}": fy,
                    "{MM}": f"{d.month:02d}", "{DD}": f"{d.day:02d}"}
            val = fmt
            for kk, vv in repl.items():
                val = val.replace(kk, str(vv))
            out[k] = val
        return Response({"preview": out})

    def get(self, request):
        return self.post(request)


class ChallanViewSet(viewsets.ModelViewSet):
    queryset = Challan.objects.prefetch_related("items").all()
    serializer_class = ChallanSerializer

    def perform_create(self, serializer):
        c = serializer.save()
        log(self.request.user.display_name, f"generated delivery challan {c.no} for {c.client_name}")

    def perform_destroy(self, instance):
        log(self.request.user.display_name, f"deleted delivery challan {instance.no}")
        instance.delete()
