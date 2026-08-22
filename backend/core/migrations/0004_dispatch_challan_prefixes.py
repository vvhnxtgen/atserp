"""Give the new dispatch / challan number series year-based prefixes."""
from django.db import migrations
from django.utils import timezone


def set_prefixes(apps, schema_editor):
    LabSettings = apps.get_model("core", "LabSettings")
    s = LabSettings.objects.filter(pk=1).first()
    if not s:
        return
    y = timezone.localdate().year
    if s.pre_dsp == "ATS/DSP/":
        s.pre_dsp = f"ATS/DSP/{y}/"
    if s.pre_dch == "ATS/DCH/":
        s.pre_dch = f"ATS/DCH/{y}/"
    s.save(update_fields=["pre_dsp", "pre_dch"])


class Migration(migrations.Migration):
    dependencies = [("core", "0003_equipment_labsettings_n_dch_labsettings_n_dsp_and_more")]
    operations = [migrations.RunPython(set_prefixes, migrations.RunPython.noop)]
