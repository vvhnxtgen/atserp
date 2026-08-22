"""Seed the settings singleton and the two default logins (admin / tech)."""
from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone


def seed(apps, schema_editor):
    LabSettings = apps.get_model("core", "LabSettings")
    User = apps.get_model("core", "User")
    y = timezone.localdate().year
    LabSettings.objects.get_or_create(pk=1, defaults={
        "pre_trf": f"ATS/TRF/{y}/", "pre_qtn": f"ATS/QTN/{y}/",
        "pre_inv": f"ATS/INV/{y}/", "pre_ind": f"ATS/IND/{y}/",
        "pre_ipo": f"ATS/IPO/{y}/",
    })
    if not User.objects.filter(username="admin").exists():
        User.objects.create(username="admin", first_name="Administrator", role="admin",
                            is_staff=True, is_superuser=True,
                            password=make_password("admin@123"))
    if not User.objects.filter(username="tech").exists():
        User.objects.create(username="tech", first_name="Technician", role="tech",
                            password=make_password("tech@123"))


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
