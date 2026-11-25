# 영수증 프린터 (세우 SLK-TS100, 80mm, ESC/POS)
# 한글은 프린터 글꼴 대신 그림으로 만들어 인쇄합니다 (나눔고딕).
# 이 파일은 고치지 않아도 됩니다. (눈송이 공방: 그림 인쇄 image 추가) 화면(app.js)에서 print({...})만 부르면 됩니다.
#
# 연결 순서대로 시도:
#   1) /dev/usb/lp0 같은 USB 프린터 장치 파일
#   2) pyusb로 USB 프린터 직접 찾기 (프린터 클래스 장치)
#   3) 보드 본체의 인쇄 중계(print_relay, 9100 포트) — 앱 상자 안에서 USB가 안 보일 때
#   4) 랜선 연결 — PRINTER_IP 에 프린터 IP를 적으면 9100 포트로 보냄
import glob
import os
import socket
import time

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, "fonts", "NanumGothic-Bold.ttf")

PRINTER_IP = ""          # 랜으로 쓸 때만 예: "192.168.0.50"
PAPER_DOTS = 576         # 80mm 용지 인쇄폭 (72mm × 8dot/mm)


# ---------- 그림 만들기 ----------
def _font(size):
    return ImageFont.truetype(FONT, size)


def _center(draw, y, text, size):
    f = _font(size)
    w = draw.textlength(text, font=f)
    draw.text(((PAPER_DOTS - w) / 2, y), text, font=f, fill=0)
    return y + int(size * 1.35)


def make_card(data):
    """영수증 한 장 그림 (흑백, 폭 576)
    data = {"title": "제목", "image": "그림 data URL", "lines": ["줄1", "줄2", ...], "big": "크게 쓸 글자", "qr": "QR로 만들 주소나 글자"}
    모두 선택 사항. 없는 칸은 건너뜀."""
    title = str(data.get("title", ""))
    lines = [str(x) for x in data.get("lines", [])]
    big = str(data.get("big", ""))
    qr = str(data.get("qr", ""))

    img = Image.new("1", (PAPER_DOTS, 2400), 1)
    d = ImageDraw.Draw(img)
    y = 20
    if title:
        y = _center(d, y, title, 44)
        d.line((30, y + 4, PAPER_DOTS - 30, y + 4), fill=0, width=3)
        y += 28
    if data.get("image"):                     # 그림 (눈송이 등) — 제목 바로 아래
        try:
            pic = _image_from_data(data.get("image"))
            img.paste(pic, ((PAPER_DOTS - pic.size[0]) // 2, y))
            y += pic.size[1] + 16
        except Exception as e:
            print("그림 인쇄 실패:", e)
    for ln in lines:
        y = _wrap(d, y, ln, 30)
    if big:
        y += 10
        y = _center(d, y, big, 80)
    if qr:
        try:
            import qrcode
            q = qrcode.QRCode(border=1, box_size=8)
            q.add_data(qr)
            q.make(fit=True)
            qi = q.make_image().convert("1")
            if qi.size[0] > 360:
                qi = qi.resize((360, 360))
            y += 10
            img.paste(qi, ((PAPER_DOTS - qi.size[0]) // 2, y))
            y += qi.size[1] + 10
        except Exception:
            y = _center(d, y, qr, 24)
    y += 6
    y = _center(d, y, time.strftime("%Y.%m.%d %H:%M"), 22)
    return img.crop((0, 0, PAPER_DOTS, min(y + 30, 2400)))



def _image_from_data(s, width=520):
    """화면(app.js)이 보낸 그림(data URL 또는 base64 PNG) → 영수증용 흑백 그림"""
    import base64, io
    s = str(s)
    if "," in s:
        s = s.split(",", 1)[1]
    im = Image.open(io.BytesIO(base64.b64decode(s)))
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    im = bg.convert("L")
    if im.size[0] != width:
        im = im.resize((width, max(1, int(im.size[1] * width / im.size[0]))), Image.LANCZOS)
    return im.point(lambda v: 0 if v < 170 else 255).convert("1")


def _wrap(draw, y, text, size):
    """긴 줄은 폭에 맞춰 자동 줄바꿈 (왼쪽 정렬)"""
    f = _font(size)
    line = ""
    for ch in text:
        if draw.textlength(line + ch, font=f) > PAPER_DOTS - 50:
            draw.text((25, y), line, font=f, fill=0)
            y += int(size * 1.35)
            line = ch.strip()
        else:
            line += ch
    draw.text((25, y), line, font=f, fill=0)
    return y + int(size * 1.35)


def make_test():
    img = Image.new("1", (PAPER_DOTS, 300), 1)
    d = ImageDraw.Draw(img)
    y = _center(d, 30, "인쇄 시험", 48)
    y = _center(d, y + 10, "한글 · 숫자 1234 · 0315", 32)
    y = _center(d, y + 10, time.strftime("%Y.%m.%d %H:%M:%S"), 26)
    return img.crop((0, 0, PAPER_DOTS, y + 30))


# ---------- ESC/POS 바이트 ----------
def to_escpos(img):
    """GS v 0 래스터 + 줄 띄움 + 자르기"""
    img = img.convert("1")
    w, h = img.size
    wb = (w + 7) // 8
    px = img.load()
    raster = bytearray()
    for yy in range(h):
        for xb in range(wb):
            b = 0
            for bit in range(8):
                xx = xb * 8 + bit
                if xx < w and px[xx, yy] == 0:      # 검은 점
                    b |= 0x80 >> bit
            raster.append(b)
    out = bytearray(b"\x1b@")                          # 초기화
    out += b"\x1da" + b"\x00"                          # 자동 상태 끄기
    out += b"\x1dv0\x00" + bytes([wb & 0xFF, wb >> 8, h & 0xFF, h >> 8])
    out += raster
    out += b"\n\n\n\n"
    out += b"\x1dV\x42\x00"                            # 줄 띄우고 자르기
    return bytes(out)


# ---------- 보내기 ----------
def _send_devfile(data):
    for path in (sorted(glob.glob("/dev/usb/lp*")) + sorted(glob.glob("/dev/lp*"))
                 + sorted(glob.glob("/dev/ttyACM*")) + sorted(glob.glob("/dev/ttyUSB*"))):   # 가상 COM 모드 대비
        try:
            with open(path, "wb") as f:
                f.write(data)
            return True, path
        except OSError:
            continue
    return False, "장치 파일 없음"


def _send_pyusb(data):
    try:
        import usb.core
        import usb.util
    except Exception:
        return False, "pyusb 없음"
    for dev in usb.core.find(find_all=True):
        try:
            for cfg in dev:
                for intf in cfg:
                    if intf.bInterfaceClass != 7:        # 7 = 프린터
                        continue
                    try:
                        if dev.is_kernel_driver_active(intf.bInterfaceNumber):
                            dev.detach_kernel_driver(intf.bInterfaceNumber)
                    except Exception:
                        pass
                    ep = usb.util.find_descriptor(
                        intf,
                        custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress)
                        == usb.util.ENDPOINT_OUT,
                    )
                    if ep is None:
                        continue
                    for i in range(0, len(data), 4096):
                        ep.write(data[i:i + 4096], timeout=5000)
                    return True, f"usb {dev.idVendor:04x}:{dev.idProduct:04x}"
        except Exception as e:
            last = str(e)
            continue
    return False, "USB 프린터 못 찾음"


def _gateway():
    """앱 상자(컨테이너)에서 본 보드 본체 주소 = 기본 게이트웨이"""
    try:
        with open("/proc/net/route") as f:
            for line in f.readlines()[1:]:
                p = line.split()
                if p[1] == "00000000":
                    g = bytes.fromhex(p[2])[::-1]
                    return ".".join(str(b) for b in g)
    except Exception:
        pass
    return None


def _send_relay(data):
    for host in [h for h in (_gateway(), "172.17.0.1", "127.0.0.1") if h]:
        try:
            with socket.create_connection((host, 9100), timeout=3) as s:
                s.sendall(data)
                s.shutdown(socket.SHUT_WR)
                reply = s.recv(64).decode(errors="ignore").strip()
            if reply.startswith("OK"):
                return True, f"중계 {host} {reply[3:]}"
            return False, f"중계 {host}: {reply or '응답 없음'}"
        except OSError:
            continue
    return False, "중계 없음"


def _send_net(data):
    if not PRINTER_IP:
        return False, "PRINTER_IP 비어 있음"
    try:
        with socket.create_connection((PRINTER_IP, 9100), timeout=5) as s:
            s.sendall(data)
        return True, f"lan {PRINTER_IP}"
    except OSError as e:
        return False, f"랜 실패: {e}"


def _with_timeout(fn, data, sec):
    """한 경로가 멈춰도 화면이 '인쇄 중...'에 갇히지 않게 시간 제한"""
    import threading
    box = {}
    def run():
        try:
            box["r"] = fn(data)
        except Exception as e:
            box["r"] = (False, f"{fn.__name__} 오류: {e}")
    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(sec)
    if t.is_alive():
        return False, f"{fn.__name__.strip('_')} {sec}초 응답 없음"
    return box.get("r", (False, "결과 없음"))


def send(img):
    try:
        data = to_escpos(img)
    except Exception as e:
        return {"ok": False, "via": f"그림 변환 오류: {e}"}
    tried = []
    for fn in (_send_devfile, _send_pyusb, _send_relay, _send_net):
        ok, msg = _with_timeout(fn, data, 8)
        print("[print]", fn.__name__, ok, msg, flush=True)
        if ok:
            return {"ok": True, "via": msg}
        tried.append(msg)
    return {"ok": False, "via": " / ".join(tried)}
