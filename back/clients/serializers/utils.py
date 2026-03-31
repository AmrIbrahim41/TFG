"""
serializers/utils.py — Shared helpers used across multiple serializers.
"""


def _build_photo_url(request, photo_field):
    """
    Returns an absolute URI for the given ImageField value.
    Uses request.build_absolute_uri() so the React frontend always receives
    a fully-qualified URL regardless of subdomain or reverse-proxy setup.
    Falls back gracefully to None so the frontend never breaks on render.
    """
    if not photo_field:
        return None
    try:
        if request is not None:
            return request.build_absolute_uri(photo_field.url)
        return photo_field.url
    except Exception:
        return None
