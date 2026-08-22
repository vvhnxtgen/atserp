from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from . import models

admin.site.site_header = "Arudhya ERP — Django Admin"


@admin.register(models.User)
class ERPUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role",)}),)
    list_display = ("username", "first_name", "role", "is_staff")


for m in (models.LabSettings, models.TRF, models.TestSpec, models.QualityDoc,
          models.Quotation, models.QuotationItem, models.CustomerPO,
          models.Indent, models.IndentItem, models.Invoice, models.InvoiceItem,
          models.InternalPO, models.InternalPOItem, models.Activity,
          models.Witness, models.Equipment, models.CalibrationCert,
          models.LabReport, models.Dispatch, models.Challan, models.ChallanItem, models.Customer):
    admin.site.register(m)
