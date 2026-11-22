def test_app_imports():
    import app.main  # noqa: F401


def test_grpc_ingest_modules_import():
    from app.grpc_server import mapping, server, service, servicer  # noqa: F401
