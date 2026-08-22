"""URL routing.

The Django service serves BOTH the REST API (/api/…) and the built React
single-page app (everything else). React Router uses path-based routes, so any
non-API, non-admin path returns index.html and the client router takes over.

If the frontend has NOT been built (frontend/dist/index.html missing), the SPA
routes return a clear message telling you to run the frontend build — instead of
a confusing 500/TemplateDoesNotExist. This is the usual "root shows API JSON /
blank page" symptom on a host where the build step didn't run.
"""
from pathlib import Path

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path
from django.views.generic import TemplateView

_INDEX = Path(settings.BASE_DIR).parent / "frontend" / "dist" / "index.html"


def api_status(_request):
    """Health + deployment diagnostics — open /api/health/ to self-diagnose."""
    from django.conf import settings as dj
    from django.db import connection
    # Which database is actually connected?
    engine = dj.DATABASES["default"]["ENGINE"].split(".")[-1]
    db_ok, db_error = True, ""
    try:
        connection.ensure_connection()
    except Exception as e:                       # pragma: no cover
        db_ok, db_error = False, str(e)[:200]
    # Is the React frontend built and being served?
    frontend_built = _INDEX.exists()
    # Have migrations been applied? (are the core tables there?)
    tables_ok = False
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1 FROM core_labsettings LIMIT 1")
            tables_ok = True
    except Exception:
        tables_ok = False
    return JsonResponse({
        "status": "success",
        "message": "Arudhya ERP API is running",
        "database": {"engine": engine, "connected": db_ok, "migrated": tables_ok,
                     **({"error": db_error} if db_error else {})},
        "frontend_built": frontend_built,
        "debug": dj.DEBUG,
        "hint": ("All good — open / for the app." if (frontend_built and db_ok and tables_ok)
                 else "Something is off: "
                      + ("frontend not built; " if not frontend_built else "")
                      + ("database not connected; " if not db_ok else "")
                      + ("migrations not applied; " if db_ok and not tables_ok else "")),
    })


def spa(request):
    """Serve the built React app, or a helpful message if it isn't built yet."""
    if _INDEX.exists():
        return TemplateView.as_view(template_name="index.html")(request)
    return HttpResponse(
        "<h2>Frontend not built</h2>"
        "<p>The API is running, but the React app hasn't been bundled. "
        "Run the build step so <code>frontend/dist/index.html</code> exists:</p>"
        "<pre>cd frontend &amp;&amp; npm ci &amp;&amp; npm run build</pre>"
        "<p>On Render, set the Build Command to <code>./render-build.sh</code> "
        "and redeploy. API health: <a href='/api/health/'>/api/health/</a></p>",
        status=503, content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", api_status),           # simple JSON health check
    path("api/", include("core.urls")),
]

# Serve uploaded media in all environments (WhiteNoise handles static assets).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA catch-all — must come LAST so it never shadows /api or /admin or /media.
urlpatterns += [
    re_path(r"^(?!api/|admin/|media/|static/).*$", spa, name="spa"),
]
