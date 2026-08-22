"""DRF serializers — nested writable items, snapshots and computed totals."""
from rest_framework import serializers

from .models import (TRF, Activity, CalibrationCert, Challan, ChallanItem, Customer,
                     CustomerPO, Dispatch, Equipment, Indent, IndentItem,
                     InternalPO, InternalPOItem, Invoice, InvoiceItem,
                     LabReport, LabSettings, QualityDoc, Quotation,
                     QuotationItem, TestSpec, User, Witness)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = ["username", "name", "role"]


class SettingsSerializer(serializers.ModelSerializer):
    next_numbers = serializers.SerializerMethodField()

    class Meta:
        model = LabSettings
        exclude = []
        read_only_fields = ["id", "n_trf", "n_qtn", "n_inv", "n_ind", "n_ipo", "n_dsp", "n_dch"]

    def get_next_numbers(self, obj):
        return {k: obj.peek(k) for k in ("trf", "qtn", "inv", "ind", "ipo", "dsp", "dch")}


class TestSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestSpec
        fields = ["test", "std", "spec", "dur"]


class TRFListSerializer(serializers.ModelSerializer):
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = TRF
        fields = ["id", "no", "date", "priority", "stage", "customer_company",
                  "sample_desc", "result_status", "has_report"]

    def get_has_report(self, obj):
        return bool(obj.report_file)


class WitnessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Witness
        fields = ["id", "trf", "name", "designation", "organization"]


class TRFSerializer(serializers.ModelSerializer):
    tests = TestSpecSerializer(many=True)
    witnesses = WitnessSerializer(many=True, read_only=True)
    report_file = serializers.FileField(read_only=True)
    op_start_image = serializers.FileField(read_only=True)
    op_end_image = serializers.FileField(read_only=True)

    class Meta:
        model = TRF
        fields = "__all__"
        read_only_fields = ["no", "stage", "created_by", "created_at",
                           "alloc_chamber", "alloc_date", "alloc_time", "alloc_engineer",
                           "alloc_remarks", "alloc_by", "alloc_at",
                           "op_start_date", "op_start_time", "op_end_date", "op_end_time",
                           "op_engineer", "op_obs", "op_by", "op_at",
                           "result_status", "result_remarks", "result_by", "result_at",
                           "report_no", "report_date", "report_by", "report_at"]

    def create(self, validated):
        tests = validated.pop("tests", [])
        if not tests:
            raise serializers.ValidationError({"tests": "Add at least one test."})
        request = self.context["request"]
        trf = TRF.objects.create(no=LabSettings.take_number("trf"),
                                 created_by=request.user.display_name, **validated)
        TestSpec.objects.bulk_create([TestSpec(trf=trf, **t) for t in tests])
        return trf


class QualityDocSerializer(serializers.ModelSerializer):
    trf = serializers.PrimaryKeyRelatedField(queryset=TRF.objects.all(),
                                             required=False, allow_null=True)

    class Meta:
        model = QualityDoc
        fields = "__all__"
        read_only_fields = ["trf_no", "uploaded_by", "created_at"]

    def create(self, validated):
        trf = validated.get("trf")
        validated["trf_no"] = trf.no if trf else ""
        validated["uploaded_by"] = self.context["request"].user.display_name
        return super().create(validated)


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ["desc", "qty", "rate"]


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True)
    sub = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gst_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    po_received = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = "__all__"
        read_only_fields = ["no", "created_by", "created_at"]

    def get_po_received(self, obj):
        return obj.pos.exists()

    def create(self, validated):
        items = validated.pop("items", [])
        if not items:
            raise serializers.ValidationError({"items": "Add at least one line item."})
        q = Quotation.objects.create(no=LabSettings.take_number("qtn"),
                                     created_by=self.context["request"].user.display_name,
                                     **validated)
        QuotationItem.objects.bulk_create([QuotationItem(quotation=q, **i) for i in items])
        return q


class CustomerPOSerializer(serializers.ModelSerializer):
    quotation_no = serializers.CharField(source="quotation.no", read_only=True, default="")

    class Meta:
        model = CustomerPO
        fields = "__all__"
        read_only_fields = ["uploaded_by", "created_at"]

    def create(self, validated):
        validated["uploaded_by"] = self.context["request"].user.display_name
        return super().create(validated)


class IndentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndentItem
        fields = ["item", "qty", "unit", "purpose"]


class IndentSerializer(serializers.ModelSerializer):
    items = IndentItemSerializer(many=True)

    class Meta:
        model = Indent
        fields = "__all__"
        read_only_fields = ["no", "raised_by", "status", "decided_by", "decided_at", "note", "created_at"]

    def create(self, validated):
        items = validated.pop("items", [])
        items = [i for i in items if i.get("item")]
        if not items:
            raise serializers.ValidationError({"items": "Add at least one item with quantity."})
        ind = Indent.objects.create(no=LabSettings.take_number("ind"),
                                    raised_by=self.context["request"].user.display_name,
                                    **validated)
        IndentItem.objects.bulk_create([IndentItem(indent=ind, **i) for i in items])
        return ind


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ["desc", "sac", "qty", "rate"]


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    sub = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gst_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    trf = serializers.PrimaryKeyRelatedField(queryset=TRF.objects.all())

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["no", "trf_no", "status", "created_by", "created_at"]

    def create(self, validated):
        items = validated.pop("items", [])
        if not items:
            raise serializers.ValidationError({"items": "Add at least one line item."})
        trf = validated["trf"]
        inv = Invoice.objects.create(no=LabSettings.take_number("inv"), trf_no=trf.no,
                                     created_by=self.context["request"].user.display_name,
                                     **validated)
        InvoiceItem.objects.bulk_create([InvoiceItem(invoice=inv, **i) for i in items])
        return inv


class InternalPOItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InternalPOItem
        fields = ["desc", "qty", "rate"]


class InternalPOSerializer(serializers.ModelSerializer):
    items = InternalPOItemSerializer(many=True)
    sub = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    gst_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = InternalPO
        fields = "__all__"
        read_only_fields = ["no", "created_by", "created_at"]

    def create(self, validated):
        items = validated.pop("items", [])
        if not items:
            raise serializers.ValidationError({"items": "Add at least one item."})
        po = InternalPO.objects.create(no=LabSettings.take_number("ipo"),
                                       created_by=self.context["request"].user.display_name,
                                       **validated)
        InternalPOItem.objects.bulk_create([InternalPOItem(po=po, **i) for i in items])
        return po


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ["user", "text", "at"]


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = "__all__"


class CalibrationCertSerializer(serializers.ModelSerializer):
    equipment = serializers.PrimaryKeyRelatedField(queryset=Equipment.objects.all(),
                                                   required=False, allow_null=True)
    expired = serializers.SerializerMethodField()

    class Meta:
        model = CalibrationCert
        fields = "__all__"
        read_only_fields = ["equipment_name", "uploaded_by", "created_at"]

    def get_expired(self, obj):
        from django.utils import timezone
        return bool(obj.expiry_date and obj.expiry_date < timezone.localdate())

    def create(self, validated):
        eq = validated.get("equipment")
        validated["equipment_name"] = eq.name if eq else validated.get("equipment_name", "")
        validated["uploaded_by"] = self.context["request"].user.display_name
        return super().create(validated)


class LabReportSerializer(serializers.ModelSerializer):
    trf = serializers.PrimaryKeyRelatedField(queryset=TRF.objects.all(),
                                             required=False, allow_null=True)

    class Meta:
        model = LabReport
        fields = "__all__"
        read_only_fields = ["trf_no", "uploaded_by", "created_at"]

    def create(self, validated):
        trf = validated.get("trf")
        validated["trf_no"] = trf.no if trf else ""
        if trf and not validated.get("client_name"):
            validated["client_name"] = trf.customer_company
        validated["uploaded_by"] = self.context["request"].user.display_name
        return super().create(validated)


class DispatchSerializer(serializers.ModelSerializer):
    trf = serializers.PrimaryKeyRelatedField(queryset=TRF.objects.all(),
                                             required=False, allow_null=True)

    class Meta:
        model = Dispatch
        fields = "__all__"
        read_only_fields = ["no", "trf_no", "created_at"]

    def create(self, validated):
        trf = validated.get("trf")
        validated["trf_no"] = trf.no if trf else ""
        if not validated.get("sent_by"):
            validated["sent_by"] = self.context["request"].user.display_name
        return Dispatch.objects.create(no=LabSettings.take_number("dsp"), **validated)

    def update(self, instance, validated):
        trf = validated.get("trf", instance.trf)
        validated["trf_no"] = trf.no if trf else ""
        return super().update(instance, validated)


class ChallanItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChallanItem
        fields = ["item", "qty", "remarks"]


class ChallanSerializer(serializers.ModelSerializer):
    items = ChallanItemSerializer(many=True)
    trf = serializers.PrimaryKeyRelatedField(queryset=TRF.objects.all(),
                                             required=False, allow_null=True)

    class Meta:
        model = Challan
        fields = "__all__"
        read_only_fields = ["no", "trf_no", "created_by", "created_at"]

    def create(self, validated):
        items = [i for i in validated.pop("items", []) if i.get("item")]
        if not items:
            raise serializers.ValidationError({"items": "Add at least one item line."})
        trf = validated.get("trf")
        validated["trf_no"] = trf.no if trf else ""
        ch = Challan.objects.create(no=LabSettings.take_number("dch"),
                                    created_by=self.context["request"].user.display_name,
                                    **validated)
        ChallanItem.objects.bulk_create([ChallanItem(challan=ch, **i) for i in items])
        return ch


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "gstin", "company", "contact", "phone", "email", "address", "state", "updated_at"]
