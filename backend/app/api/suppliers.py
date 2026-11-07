import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import schemas as s
from app.config import settings
from app.db import get_db
from app.errors import AppError
from app.models import Document, Supplier
from app.services import queries
from app.services.extraction import doc_type_from_filename

router = APIRouter(prefix="/api")
MAX_FILES = 10


@router.get("/suppliers", response_model=list[s.SupplierSummary])
def list_suppliers(db: Session = Depends(get_db)):
    return queries.list_suppliers(db)


@router.post("/suppliers", response_model=s.SupplierDetail, status_code=201)
def create_supplier(body: s.SupplierInput, db: Session = Depends(get_db)):
    sup = Supplier(**body.model_dump(), name_key=body.name.lower())
    db.add(sup)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, f"A supplier named '{body.name}' already exists")
    return queries.supplier_detail(db, sup)


@router.get("/suppliers/{supplier_id}", response_model=s.SupplierDetail)
def get_supplier(supplier_id: s.DbId, db: Session = Depends(get_db)):
    return queries.supplier_detail(db, queries.supplier_or_404(db, supplier_id))


@router.post("/suppliers/{supplier_id}/documents", response_model=list[s.SupplierDocument], status_code=201)
def upload_documents(supplier_id: s.DbId, files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    queries.supplier_or_404(db, supplier_id)
    if not 1 <= len(files) <= MAX_FILES:
        raise AppError(400, f"Upload between 1 and {MAX_FILES} files")
    limit = settings.max_upload_mb * 1024 * 1024
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    saved, written = [], []
    try:
        for f in files:
            data = f.file.read(limit + 1)
            if len(data) > limit:
                raise AppError(413, f"{f.filename} is larger than {settings.max_upload_mb} MB")
            if not data.startswith(b"%PDF-"):
                raise AppError(415, f"{f.filename} is not a PDF")
            # Server-generated name; the original filename is metadata only.
            path = settings.upload_dir / f"{uuid.uuid4().hex}.pdf"
            path.write_bytes(data)
            written.append(path)
            name = (f.filename or "document.pdf").replace("/", "_").replace("\\", "_").replace('"', "")[:300]
            doc = Document(supplier_id=supplier_id, filename=name, doc_type=doc_type_from_filename(name),
                           storage_path=str(path))
            db.add(doc)
            saved.append(doc)
        db.commit()
    except Exception:
        db.rollback()
        for p in written:
            p.unlink(missing_ok=True)
        raise
    return [s.SupplierDocument.model_validate(d) for d in saved]


@router.get("/documents/{document_id}/file")
def document_file(document_id: s.DbId, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None or not Path(doc.storage_path).is_file():  # a deleted upload is a 404, not a 500
        raise AppError(404, "Document not found")
    # filename= lets Starlette RFC 5987-encode non-Latin-1 names (a raw header would crash on "–" or CJK)
    return FileResponse(doc.storage_path, media_type="application/pdf", filename=doc.filename,
                        content_disposition_type="inline")
