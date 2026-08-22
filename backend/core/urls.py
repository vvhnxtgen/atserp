from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("trfs", views.TRFViewSet)
router.register("quality-docs", views.QualityDocViewSet)
router.register("quotations", views.QuotationViewSet)
router.register("customer-pos", views.CustomerPOViewSet)
router.register("indents", views.IndentViewSet)
router.register("invoices", views.InvoiceViewSet)
router.register("internal-pos", views.InternalPOViewSet)
router.register("witnesses", views.WitnessViewSet)
router.register("equipment", views.EquipmentViewSet)
router.register("calibration-certs", views.CalibrationCertViewSet)
router.register("lab-reports", views.LabReportViewSet)
router.register("dispatches", views.DispatchViewSet)
router.register("challans", views.ChallanViewSet)
router.register("customers", views.CustomerViewSet)

urlpatterns = [
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("auth/passwords/", views.PasswordsView.as_view()),
    path("settings/", views.SettingsView.as_view()),
    path("numbering-preview/", views.NumberingPreviewView.as_view()),
    path("trace/", views.TraceView.as_view()),
    path("dashboard/", views.DashboardView.as_view()),
    path("finance/", views.FinanceView.as_view()),
    path("seed-demo/", views.SeedDemoView.as_view()),
    path("", include(router.urls)),
]
