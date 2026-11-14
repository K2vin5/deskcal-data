# deskcal-holidays — DeskCal 공휴일·24절기 데이터

DeskCal 앱이 하루에 한 번 내려받는 `holidays.json` 을 보관하는 **공개 저장소**용 파일입니다.
GitHub Actions 가 매월 1일 한국천문연구원 특일 정보 API 로 파일을 새로 만들고, 내용이 바뀌었을 때만 커밋합니다.
앱 사용자는 API 키를 넣을 필요가 없습니다.

- 출처: 한국천문연구원 특일 정보 (공공데이터포털, data.go.kr)
- 파일 형식: `version`, `updated_at`, `source`, `years` (연도별 `[{date, name, kind, isOffDay}]`)
- 지금 들어 있는 `holidays.json` 은 앱 내장 계산값으로 만든 **임시 데이터**입니다. 아래 5단계에서 Actions 를 한 번 실행하면 천문연 API 값으로 바뀝니다.

```
holidays.json                  앱이 내려받는 파일
scripts/fetch_holidays.mjs     API 로 holidays.json 을 만드는 스크립트 (Node 20, 패키지 설치 필요 없음)
.github/workflows/update.yml   매월 1일 자동 실행 + 수동 실행
```

---

## 처음 한 번만: 공개 저장소 만들기 (초보자용, 약 15분)

### 1단계. 공공데이터포털 API 키 받기

1. https://www.data.go.kr 에 로그인합니다.
2. 검색창에 **한국천문연구원_특일 정보** 를 검색 → **활용신청** (목적: "개인 앱 공휴일 표시" 정도로 적으면 됩니다).
3. 보통 바로, 늦으면 1~2시간 안에 승인됩니다.
4. 마이페이지 → 데이터활용 → 개발계정 → 방금 신청한 API → **일반 인증키(Decoding)** 를 복사해 메모장에 잠시 붙여 둡니다.
   - 이 키는 **절대 파일에 적거나 공개하지 마세요.** 아래 3단계의 Secret 에만 넣습니다.

### 2단계. GitHub 저장소 만들기

1. https://github.com 에 가입·로그인합니다.
2. 오른쪽 위 **+** → **New repository**.
3. 입력:
   - Repository name: **`deskcal-holidays`** (앱의 기본 주소가 이 이름을 씁니다)
   - **Public** 선택 (앱이 로그인 없이 내려받으려면 공개여야 합니다. 키는 공개되지 않습니다)
   - "Add a README file" 은 **체크하지 않기**
4. **Create repository**.

### 3단계. 파일 올리기

**방법 A — 웹 브라우저로 (가장 쉬움)**

1. 방금 만든 저장소 화면에서 **uploading an existing file** 링크를 누릅니다.
2. 탐색기에서 이 `data-repo` 폴더를 열고, 안의 **`holidays.json`, `README.md`, `scripts` 폴더, `.github` 폴더**를 모두 선택해 브라우저 창으로 끌어다 놓습니다.
   - `.github` 폴더가 안 보이면: 탐색기 메뉴 **보기 → 표시 → 숨긴 항목** 체크.
3. 아래 **Commit changes** 를 누릅니다.
4. 저장소 첫 화면에 `.github/workflows/update.yml` 이 있는지 확인합니다. (없으면 **Add file → Create new file** 에서 이름 칸에 `.github/workflows/update.yml` 을 입력하고 파일 내용을 붙여 넣어 만듭니다)

**방법 B — 명령어로 (Git 설치되어 있을 때)**

PowerShell 에서 이 `data-repo` 폴더로 이동한 뒤 한 줄씩 실행 (`내아이디` 를 본인 GitHub 아이디로):

```bash
git init -b main
```

```bash
git add .
```

```bash
git commit -m "첫 커밋"
```

```bash
git remote add origin https://github.com/내아이디/deskcal-holidays.git
```

```bash
git push -u origin main
```

### 4단계. API 키를 Secret 으로 등록

1. 저장소 화면 위쪽 **Settings** → 왼쪽 **Secrets and variables** → **Actions**.
2. **New repository secret**.
3. Name: **`KASI_API_KEY`** (철자 그대로), Secret: 1단계에서 복사한 키 → **Add secret**.
   - Secret 은 저장 후 다시 볼 수 없고, Actions 로그에도 `***` 로 가려집니다.
4. (확인) **Settings → Actions → General** 맨 아래 **Workflow permissions** 가 "Read and write permissions" 가 아니어도 됩니다. 워크플로 파일이 필요한 권한을 직접 요청합니다. 단, 조직(Organization) 저장소라서 막혀 있으면 "Read and write permissions" 로 바꾸고 Save.

### 5단계. 처음 한 번 수동 실행

1. 저장소 위쪽 **Actions** 탭 → (처음이면 "I understand my workflows, go ahead and enable them" 클릭)
2. 왼쪽 **Update holidays.json** → 오른쪽 **Run workflow** → 초록 **Run workflow**.
3. 1~2분 뒤 초록 체크(✓)가 뜨면 성공. 저장소 첫 화면에 "chore: holidays.json 자동 갱신" 커밋이 생깁니다.
   - 빨간 ✕ 면 실행 기록을 눌러 로그를 봅니다. "KASI_API_KEY 환경변수가 없습니다" → 4단계 이름 철자 확인, "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" → 키 승인 대기 중이거나 Decoding 키가 아님.

### 6단계. 앱에서 쓸 주소 확인

브라우저에서 아래 주소를 열어 JSON 이 보이면 완료입니다 (`내아이디` 바꾸기):

```
https://raw.githubusercontent.com/내아이디/deskcal-holidays/main/holidays.json
```

그다음 DeskCal 프로젝트의 `src/config.ts` 에서 `YOUR_GITHUB_ID` 를 본인 아이디로 바꾸고 설치 파일을 다시 만듭니다 (`npm run tauri build`).
- 바꾸기 전에 시험해 보려면: 앱 설정 → 정보 → 버전 글자 5번 클릭 → 개발자 옵션 → "원격 데이터 주소" 에 위 주소를 넣고 **지금 확인**.

---

## 그 뒤로는 자동

- 매월 1일 한국 시간 오전 9시에 자동 실행됩니다. 바뀐 게 없으면 커밋하지 않습니다.
- 임시공휴일이 갑자기 지정되면 Actions → Run workflow 로 바로 실행하면 됩니다.
- 앱은 하루 한 번 이 파일을 확인하고, 내려받기에 실패하면 이전에 받아 둔 데이터 → 앱 내장 데이터 순서로 씁니다.
- 형식이 이상한 파일(잘림, 절기 24개가 아님 등)은 앱이 무시하고 기존 데이터를 유지합니다.

### 알아둘 점

- GitHub 는 **60일 동안 저장소 활동이 없으면 예약 실행을 자동으로 끕니다.** 워크플로 마지막 단계에서 매번 스스로 다시 켜도록 해 두었지만, 혹시 "scheduled workflow disabled" 메일이 오면 Actions 탭에서 **Enable workflow** 를 한 번 눌러 주세요.
- 이 저장소는 공개되지만 API 키는 Secret 에만 있으므로 다른 사람이 볼 수 없습니다.

## 직접 실행해 보기 (선택, Node 20 이상)

```bash
$env:KASI_API_KEY="발급받은_키"; node scripts/fetch_holidays.mjs
```
