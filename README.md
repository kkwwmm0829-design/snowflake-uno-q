# 나만의 눈송이 공방 (UNO Q · App Lab)

버튼 4개 + 조이스틱 + 노트북 화면 + 영수증 프린터(80mm). 자세한 내용은 소개.md.

## 파일
| 파일 | 역할 |
|---|---|
| `assets/app.js` | 화면 규칙 — 눈송이 만들기, 프랙탈, 인쇄 |
| `assets/index.html` | 겨울 디자인 화면 |
| `assets/libs/` | socket.io, arduino.js (그대로) |
| `python/main.py` | 화면 ↔ 보드 ↔ 프린터 중계 |
| `python/printer.py` | 영수증 그림 만들기 + 인쇄 (**그림 image 인쇄 추가됨**) |
| `python/fonts/` | 나눔고딕 (SIL OFL) |
| `sketch/sketch.ino` | 버튼·조이스틱 읽기 (핀: A D2 · B D3 · C D4 · D D5 · ↑ D13 · ↓ D11 · ← D12 · → D10) |

## 보드에 올리기
1. App Lab → 「내 교구 뼈대」 → 이름 옆 ▾ → Duplicate → 이름 `Snowflake`
2. 아래 3개 파일을 열어 전체 선택 → 지우기 → 이 폴더의 같은 파일 내용 붙여넣기 → 저장(Ctrl+S)
   - `assets/app.js`
   - `assets/index.html`
   - `python/printer.py`
3. ▶ Run → 노트북 브라우저에서 `http://보드IP:7000`
4. 키보드 시험: 방향키 = 조이스틱, 1 2 3 4 = A B C D
   (assets/index.html 을 더블클릭해 열면 인쇄는 「보드 없음」이 정상)
