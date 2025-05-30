import fitz  # PyMuPDF
from PIL import Image
import io


def calculate_scaled_rect(sig, page_width, page_height):
    """
    将签名框的 canvas 像素坐标映射到 PDF 页面的坐标空间中。
    """
    canvas_width = float(sig.get("preview_width", 1240))
    canvas_height = float(sig.get("preview_height", 1754))

    # 缩放因子（独立缩放，支持非等比）
    scale_x = page_width / canvas_width
    scale_y = page_height / canvas_height

    left = float(sig["left"])
    top = float(sig["top"])
    width = float(sig["width"])
    height = float(sig["height"])

    # PDF 坐标系从左上角 -> 右下角
    x0 = left * scale_x
    y0 = top * scale_y
    x1 = (left + width) * scale_x
    y1 = (top + height) * scale_y

    return fitz.Rect(x0, y0, x1, y1)


def insert_signatures_into_pdf(pdf_path, output_path, signatures):
    """
    将签名图像插入 PDF 对应页的签名区域。
    """
    doc = fitz.open(pdf_path)

    for idx, sig in enumerate(signatures, 1):
        try:
            page_index = int(sig["page"]) - 1
            if page_index >= len(doc):
                print(f"⚠️ 签名 {idx}：页码 {sig['page']} 超出文档范围")
                continue

            page = doc[page_index]
            page_width = page.rect.width
            page_height = page.rect.height

            rect = calculate_scaled_rect(sig, page_width, page_height)

            # 解码 base64 图片数据
            image_bytes = sig.get("image_bytes")
            if not image_bytes:
                print(f"⚠️ 签名 {idx}：无图像数据")
                continue

            img = Image.open(io.BytesIO(image_bytes))
            img_stream = io.BytesIO()
            img.save(img_stream, format="PNG")
            img_stream.seek(0)

            page.insert_image(rect, stream=img_stream.read())
            print(f"✅ 签名 {idx} 成功插入第 {page_index + 1} 页")

        except Exception as e:
            print(f"❌ 签名 {idx} 插入失败：{e}")

    doc.save(output_path)
    doc.close()
    print(f"🎉 所有签名插入完成，已保存至 {output_path}")
