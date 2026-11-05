import os
import io
import base64
import tempfile
import uuid
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from commonforms.inference import render_pdf, FFDNetDetector, FFDetrDetector
from commonforms.form_creator import PyPdfFormCreator, rect_for, Textbox, Checkbox, Signature
from commonforms.utils import BoundingBox
from commonforms import prepare_form
from PIL import Image
from pydantic import BaseModel
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject, NumberObject, ArrayObject, FloatObject
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import starlette.formparsers

# Increase Starlette multipart part size limit from 1MB to 50MB so large fields/base64 never fail
starlette.formparsers.MultiPartParser.spool_max_size = 50 * 1024 * 1024
_orig_multipart_init = starlette.formparsers.MultiPartParser.__init__

def _patched_multipart_init(self, *args, **kwargs):
    kwargs['max_part_size'] = 50 * 1024 * 1024
    _orig_multipart_init(self, *args, **kwargs)

starlette.formparsers.MultiPartParser.__init__ = _patched_multipart_init



def hex_to_rgb(hex_str: str | None, default=(0.06, 0.09, 0.16)):
    """Convert hex color string (#1664D9) to RGB tuple of floats [0, 1]."""
    if not hex_str:
        return default
    clean = hex_str.strip().lstrip('#')
    if len(clean) == 6:
        try:
            return (
                int(clean[0:2], 16) / 255.0,
                int(clean[2:4], 16) / 255.0,
                int(clean[4:6], 16) / 255.0,
            )
        except ValueError:
            pass
    return default

app = FastAPI(title="CommonForms API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for temp file paths keyed by request_id
# so /build-pdf can reference the original file later
temp_files: dict[str, str] = {}


# Helper function to clean up files
def cleanup_temp_files(filepaths: list):
    for path in filepaths:
        try:
            if os.path.exists(path):
                os.remove(path)
                print(f"Cleaned up {path}")
        except Exception as e:
            print(f"Failed to delete {path}: {e}")


def save_upload_and_convert(file_content: bytes, filename: str, request_id: str) -> str:
    """Save an uploaded file, converting images to PDF if necessary.
    Returns the path to a PDF file."""
    temp_dir = tempfile.gettempdir()
    ext = os.path.splitext(filename)[1].lower()
    input_path = os.path.join(temp_dir, f"input_{request_id}{ext}")

    with open(input_path, "wb") as f:
        f.write(file_content)

    # Convert image to PDF if necessary
    if ext in ('.jpg', '.jpeg', '.png'):
        pdf_input_path = os.path.join(temp_dir, f"input_{request_id}.pdf")
        img = Image.open(input_path)
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        img.save(pdf_input_path, 'PDF')
        img.close()
        print(f"Converted image {input_path} -> {pdf_input_path}")
        # Clean up the original image file
        os.remove(input_path)
        return pdf_input_path

    return input_path


def detect_fields_sync(
    pdf_path: str,
    model: str,
    image_size: int,
    confidence: float,
    fast: bool,
    device: str,
):
    """Run detection synchronously (to be called via run_in_threadpool)."""
    # Build detector
    if "FFDNET" in model.upper():
        detector = FFDNetDetector(model, device=device, fast=fast)
    else:
        detector = FFDetrDetector(model)

    # Render PDF pages to images
    pages = render_pdf(pdf_path)

    # Detect fields
    results = detector.extract_widgets(
        pages, confidence=confidence, image_size=image_size
    )

    # Convert page images to base64 data URLs
    page_images = []
    for page in pages:
        buf = io.BytesIO()
        page.image.save(buf, format='PNG')
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        page_images.append({
            "data_url": f"data:image/png;base64,{b64}",
            "width": page.width,
            "height": page.height,
        })

    # Convert detected widgets to serializable dicts
    fields = []
    field_id = 0
    for page_ix, widgets in results.items():
        for widget in widgets:
            fields.append({
                "id": f"field_{field_id}",
                "type": widget.widget_type,  # TextBox, ChoiceButton, Signature
                "page": page_ix,
                "x0": widget.bounding_box.x0,
                "y0": widget.bounding_box.y0,
                "x1": widget.bounding_box.x1,
                "y1": widget.bounding_box.y1,
                "fontSize": 12,
                "color": "#000000",
            })
            field_id += 1

    return page_images, fields


@app.post("/detect-fields")
async def detect_fields(
    file: UploadFile = File(...),
    model: str = Form("FFDNet-L"),
    image_size: int = Form(1600),
    confidence: float = Form(0.3),
    fast: bool = Form(False),
    device: str = Form("cpu"),
):
    """Detect form fields and return page images + field metadata as JSON."""
    valid_extensions = ('.pdf', '.jpg', '.jpeg', '.png')
    if not file.filename.lower().endswith(valid_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF and image files are supported. Got: {file.filename}"
        )

    request_id = str(uuid.uuid4())
    file_content = await file.read()

    try:
        pdf_path = save_upload_and_convert(file_content, file.filename, request_id)

        # Store the path so /build-pdf can use it later
        temp_files[request_id] = pdf_path

        page_images, fields = await run_in_threadpool(
            detect_fields_sync,
            pdf_path,
            model,
            image_size,
            confidence,
            fast,
            device,
        )

        return JSONResponse({
            "request_id": request_id,
            "pages": page_images,
            "fields": fields,
        })

    except Exception as e:
        # Clean up on failure
        if request_id in temp_files:
            cleanup_temp_files([temp_files.pop(request_id)])
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/build-pdf")
async def build_pdf(
    background_tasks: BackgroundTasks,
    request_id: str = Form(...),
    fields_json: str = Form(...),
    keep_existing_fields: bool = Form(False),
    use_signature_fields: bool = Form(False),
    multiline: bool = Form(False),
    flatten: bool = Form(True),
    original_file: UploadFile | None = File(None),
    page_image: str | None = Form(None),
    page_image_file: UploadFile | None = File(None),
):
    """Build a processed PDF with stamped signatures, photos, and optional flattening (no blue boxes)."""
    temp_dir = tempfile.gettempdir()
    created_from_image = False
    pdf_path = temp_files.get(request_id)

    # 1. Check if the temp file still exists on disk from earlier in the session
    candidate_path = os.path.join(temp_dir, f"input_{request_id}.pdf")
    if not pdf_path or not os.path.exists(pdf_path):
        if os.path.exists(candidate_path):
            pdf_path = candidate_path
            temp_files[request_id] = pdf_path

    # 2. If missing (e.g. server reloaded), check if original_file was supplied with this request
    if not pdf_path or not os.path.exists(pdf_path):
        if original_file and original_file.filename:
            try:
                content = await original_file.read()
                pdf_path = save_upload_and_convert(content, original_file.filename, request_id)
                temp_files[request_id] = pdf_path
            except Exception as e:
                print(f"Warning: Failed to use original_file: {e}")

    # 3. If still missing, create PDF from page_image or page_image_file if provided
    if not pdf_path or not os.path.exists(pdf_path):
        if page_image_file:
            try:
                content = await page_image_file.read()
                pil_img = Image.open(io.BytesIO(content))
                if pil_img.mode in ('RGBA', 'LA'):
                    bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                    bg.paste(pil_img, mask=pil_img.split()[-1])
                    pil_img = bg
                elif pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')

                pdf_path = os.path.join(temp_dir, f"input_{request_id}.pdf")
                pil_img.save(pdf_path, 'PDF')
                pil_img.close()
                created_from_image = True
                temp_files[request_id] = pdf_path
            except Exception as conv_err:
                raise HTTPException(status_code=400, detail=f"Failed to generate base PDF from image file: {conv_err}")
        elif page_image:
            try:
                raw_data = page_image.split(',', 1)[1] if ',' in page_image else page_image
                img_bytes = base64.b64decode(raw_data)
                pil_img = Image.open(io.BytesIO(img_bytes))
                if pil_img.mode in ('RGBA', 'LA'):
                    bg = Image.new('RGB', pil_img.size, (255, 255, 255))
                    bg.paste(pil_img, mask=pil_img.split()[-1])
                    pil_img = bg
                elif pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')

                pdf_path = os.path.join(temp_dir, f"input_{request_id}.pdf")
                pil_img.save(pdf_path, 'PDF')
                pil_img.close()
                created_from_image = True
                temp_files[request_id] = pdf_path
            except Exception as conv_err:
                raise HTTPException(status_code=400, detail=f"Failed to generate base PDF from image: {conv_err}")
        else:
            temp_files.pop(request_id, None)
            raise HTTPException(status_code=404, detail="Session expired. Please re-upload and detect fields again.")

    try:
        fields = json.loads(fields_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid fields JSON.")

    output_path = os.path.join(temp_dir, f"output_{request_id}.pdf")

    try:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()

        # Step 1: Stamp images, signatures, and (if flatten=True) text & checkboxes directly onto pages
        for page_ix, page in enumerate(reader.pages):
            crop = page.cropbox if page.cropbox else page.mediabox
            crop_x0 = float(crop.left)
            crop_y0 = float(crop.bottom)
            crop_x1 = float(crop.right)
            crop_y1 = float(crop.top)
            crop_w = crop_x1 - crop_x0
            crop_h = crop_y1 - crop_y0
            page_w = float(page.mediabox.width)
            page_h = float(page.mediabox.height)

            page_fields = [f for f in fields if f.get('page', 0) == page_ix]

            # Check if there are any fields to render on this page
            needs_overlay = len(page_fields) > 0

            if needs_overlay:
                ov_packet = io.BytesIO()
                can = canvas.Canvas(ov_packet, pagesize=(page_w, page_h))

                for f in page_fields:
                    bx = crop_x0 + (f.get('x0', 0) * crop_w)
                    by = crop_y0 + ((1.0 - f.get('y1', 0)) * crop_h)
                    bw = (f.get('x1', 0) - f.get('x0', 0)) * crop_w
                    bh = (f.get('y1', 0) - f.get('y0', 0)) * crop_h
                    ftype = f.get('type')
                    val = str(f.get('value', '') or '').strip()
                    checked = bool(f.get('checked', False))

                    # 1. TextBox & DateField: Transparent border at download time + cleanly aligned text
                    if ftype in ('TextBox', 'DateField'):
                        if val:
                            raw_size = f.get('fontSize')
                            try:
                                font_size = float(raw_size) if raw_size else 12.0
                            except (ValueError, TypeError):
                                font_size = 12.0

                            # Determine PDF font face from fontFamily + bold/italic
                            is_bold = bool(f.get('bold', False))
                            is_italic = bool(f.get('italic', False))
                            font_family = f.get('fontFamily', 'Helvetica') or 'Helvetica'

                            # Map web fonts to ReportLab built-in fonts
                            font_map = {
                                'Inter': 'Helvetica', 'Helvetica': 'Helvetica', 'Arial': 'Helvetica',
                                'Times New Roman': 'Times-Roman', 'Georgia': 'Times-Roman',
                                'Courier New': 'Courier', 'Verdana': 'Helvetica',
                                'Trebuchet MS': 'Helvetica', 'Roboto': 'Helvetica', 'Open Sans': 'Helvetica',
                            }
                            base_font = font_map.get(font_family, 'Helvetica')

                            if base_font == 'Helvetica':
                                if is_bold and is_italic:
                                    pdf_font = 'Helvetica-BoldOblique'
                                elif is_bold:
                                    pdf_font = 'Helvetica-Bold'
                                elif is_italic:
                                    pdf_font = 'Helvetica-Oblique'
                                else:
                                    pdf_font = 'Helvetica'
                            elif base_font == 'Times-Roman':
                                if is_bold and is_italic:
                                    pdf_font = 'Times-BoldItalic'
                                elif is_bold:
                                    pdf_font = 'Times-Bold'
                                elif is_italic:
                                    pdf_font = 'Times-Italic'
                                else:
                                    pdf_font = 'Times-Roman'
                            elif base_font == 'Courier':
                                if is_bold and is_italic:
                                    pdf_font = 'Courier-BoldOblique'
                                elif is_bold:
                                    pdf_font = 'Courier-Bold'
                                elif is_italic:
                                    pdf_font = 'Courier-Oblique'
                                else:
                                    pdf_font = 'Courier'
                            else:
                                pdf_font = base_font

                            text_align = f.get('textAlign', 'left') or 'left'
                            tr, tg, tb = hex_to_rgb(f.get('color'), default=(0.0, 0.0, 0.0))
                            can.setFillColorRGB(tr, tg, tb)

                            padding_x = 4.0

                            # Helper to draw a single line with alignment
                            def draw_aligned(text, y_pos):
                                if text_align == 'center':
                                    can.drawCentredString(bx + bw / 2.0, y_pos, text)
                                elif text_align == 'right':
                                    can.drawRightString(bx + bw - padding_x, y_pos, text)
                                else:
                                    can.drawString(bx + padding_x, y_pos, text)

                            # Only treat as multiline if the text actually contains newlines
                            if '\n' in val:
                                lines = val.splitlines()
                                line_h = font_size * 1.25
                                start_y = by + bh - 3.0 - (font_size * 0.75)
                                can.setFont(pdf_font, font_size)
                                for l_ix, line_text in enumerate(lines):
                                    cur_y = start_y - (l_ix * line_h)
                                    if cur_y < by:
                                        break
                                    draw_aligned(line_text, cur_y)
                            else:
                                # Single-line: always vertically center
                                can.setFont(pdf_font, font_size)
                                base_y = by + (bh / 2.0) - (0.35 * font_size)
                                draw_aligned(val, base_y)

                    # 2. Checkboxes & Radio buttons: Transparent border at download time + check
                    elif ftype in ('ChoiceButton', 'RadioButton'):
                        if checked:
                            cx = bx + bw / 2.0
                            cy = by + bh / 2.0
                            cr, cg, cb = hex_to_rgb(f.get('color'), default=(0.0, 0.0, 0.0))
                            can.setStrokeColorRGB(cr, cg, cb)
                            can.setFillColorRGB(cr, cg, cb)
                            if ftype == 'ChoiceButton':
                                sz = min(bw, bh) * 0.4
                                p = can.beginPath()
                                p.moveTo(cx - sz * 0.7, cy)
                                p.lineTo(cx - sz * 0.1, cy - sz * 0.5)
                                p.lineTo(cx + sz * 0.8, cy + sz * 0.7)
                                can.setLineWidth(max(1.8, sz * 0.25))
                                can.drawPath(p, stroke=1, fill=0)
                            else:
                                r = min(bw, bh) * 0.25
                                can.circle(cx, cy, r, stroke=0, fill=1)

                    # 3. Signature & ImageUpload: Transparent border at download time + image/signature
                    elif ftype in ('Signature', 'ImageUpload'):
                        if f.get('imageData'):
                            try:
                                raw = f['imageData'].split(',', 1)[1] if ',' in f['imageData'] else f['imageData']
                                f_img = Image.open(io.BytesIO(base64.b64decode(raw)))
                                f_buf = io.BytesIO()
                                f_img.save(f_buf, format='PNG')
                                f_buf.seek(0)
                                can.drawImage(
                                    ImageReader(f_buf),
                                    bx + 1, by + 1,
                                    width=bw - 2, height=bh - 2,
                                    mask='auto',
                                    preserveAspectRatio=True,
                                    anchor='c'
                                )
                            except Exception as img_err:
                                print(f"Error stamping image for field {f.get('id')}: {img_err}")
                        elif ftype == 'Signature' and val:
                            raw_size = f.get('fontSize')
                            try:
                                sig_font_size = float(raw_size) if raw_size else 14.0
                            except (ValueError, TypeError):
                                sig_font_size = 14.0
                            can.setFont("Helvetica-Oblique", sig_font_size)
                            sr, sg, sb = hex_to_rgb(f.get('color'), default=(0.0, 0.0, 0.0))
                            can.setFillColorRGB(sr, sg, sb)
                            sig_y = by + (bh / 2.0) - (0.35 * sig_font_size)
                            can.drawString(bx + 4.0, sig_y, val)

                can.save()
                ov_packet.seek(0)
                ov_pdf = PdfReader(ov_packet)
                if len(ov_pdf.pages) > 0:
                    page.merge_page(ov_pdf.pages[0])

            writer.add_page(page)

        # If user explicitly requested interactive form fields (not flattened)
        if not flatten:
            temp_stamped_path = os.path.join(temp_dir, f"stamped_{request_id}.pdf")
            with open(temp_stamped_path, "wb") as st_fp:
                writer.write(st_fp)

            form_creator = PyPdfFormCreator(temp_stamped_path)
            if not keep_existing_fields:
                form_creator.clear_existing_fields()

            for i, field in enumerate(fields):
                # Don't add text box over already stamped image or signature
                if field.get('imageData') and field['type'] in ('Signature', 'ImageUpload'):
                    continue

                name = f"{field['type'].lower()}_{field.get('page', 0)}_{i}"
                bbox = BoundingBox(
                    x0=field['x0'],
                    y0=field['y0'],
                    x1=field['x1'],
                    y1=field['y1'],
                )
                page_ix = field.get('page', 0)
                if page_ix >= len(form_creator.writer.pages):
                    continue

                value = field.get('value', '')
                checked = field.get('checked', False)
                rect = rect_for(bbox, form_creator.writer.pages[page_ix])

                if field['type'] in ('TextBox', 'DateField'):
                    annotation = Textbox(name=name, rect=rect, multiline=multiline if field['type'] == 'TextBox' else False, value=value or None)
                    # Transparent border on interactive fields
                    annotation[NameObject("/BS")] = DictionaryObject({
                        NameObject("/W"): NumberObject(0),
                        NameObject("/S"): NameObject("/S"),
                    })
                    raw_size = field.get('fontSize')
                    try:
                        acro_font_size = float(raw_size) if raw_size else 12.0
                    except (ValueError, TypeError):
                        acro_font_size = 12.0
                    annotation[NameObject("/DA")] = TextStringObject(f"/Helv {acro_font_size:.1f} Tf {tr:.3f} {tg:.3f} {tb:.3f} rg")
                    form_creator.writer.add_annotation(page_number=page_ix, annotation=annotation)
                elif field['type'] in ('ChoiceButton', 'RadioButton'):
                    annotation = Checkbox(name=name, rect=rect, value=checked)
                    annotation[NameObject("/BS")] = DictionaryObject({
                        NameObject("/W"): NumberObject(0),
                        NameObject("/S"): NameObject("/S"),
                    })
                    form_creator.writer.add_annotation(page_number=page_ix, annotation=annotation)
                elif field['type'] in ('Signature', 'ImageUpload'):
                    if use_signature_fields:
                        annotation = Signature(name=name, rect=rect)
                    else:
                        annotation = Textbox(name=name, rect=rect, value=value or None)
                        annotation[NameObject("/BS")] = DictionaryObject({
                            NameObject("/W"): NumberObject(0),
                            NameObject("/S"): NameObject("/S"),
                        })
                    form_creator.writer.add_annotation(page_number=page_ix, annotation=annotation)

            form_creator.save(output_path)
            form_creator.close()
            cleanup_temp_files([temp_stamped_path])
        else:
            with open(output_path, "wb") as out_fp:
                writer.write(out_fp)

        # Clean up generated output file after download; retain input pdf for re-downloads
        background_tasks.add_task(cleanup_temp_files, [output_path])

        return FileResponse(
            path=output_path,
            filename=f"processed_form.pdf",
            media_type="application/pdf",
        )

    except Exception as e:
        cleanup_temp_files([output_path])
        raise HTTPException(status_code=500, detail=str(e))


# --- Legacy endpoint (kept for backward compatibility) ---

@app.post("/process-pdf")
async def process_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("FFDNet-L"),
    keep_existing_fields: bool = Form(False),
    use_signature_fields: bool = Form(False),
    image_size: int = Form(1600),
    confidence: float = Form(0.3),
    fast: bool = Form(False),
    device: str = Form("cpu")
):
    print(f"Received file: {file.filename}")
    valid_extensions = ('.pdf', '.jpg', '.jpeg', '.png')

    if not file.filename.lower().endswith(valid_extensions):
        raise HTTPException(status_code=400, detail=f"Only PDF and image files are supported. Got: {file.filename}")

    request_id = str(uuid.uuid4())
    temp_dir = tempfile.gettempdir()
    output_path = os.path.join(temp_dir, f"output_{request_id}.pdf")
    file_content = await file.read()

    try:
        input_path = save_upload_and_convert(file_content, file.filename, request_id)

        print(f"Processing {input_path} -> {output_path} with model={model}, image_size={image_size}")

        await run_in_threadpool(
            prepare_form,
            input_path,
            output_path,
            model_or_path=model,
            keep_existing_fields=keep_existing_fields,
            use_signature_fields=use_signature_fields,
            image_size=image_size,
            confidence=confidence,
            fast=fast,
            device=device
        )

        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="Processing failed, output file not generated.")

        background_tasks.add_task(cleanup_temp_files, [input_path, output_path])

        return FileResponse(
            path=output_path,
            filename=f"processed_{os.path.splitext(file.filename)[0]}.pdf",
            media_type="application/pdf"
        )

    except Exception as e:
        cleanup_temp_files([input_path, output_path])
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def read_root():
    return {"status": "ok", "message": "CommonForms API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)