# PIXEL MART 팀 세팅 가이드

처음 합류한 팀원은 **STEP 0 → STEP 2 → STEP 3** 순서로 따라오면 됩니다.

---

## STEP 0. 전원 — 설치 확인 (10~20분)

### 0-1. Node.js (LTS)
- **Windows**: https://nodejs.org 에서 **LTS** 설치 파일을 받아 기본값으로 설치하거나, 터미널에서:
  ```
  winget install OpenJS.NodeJS.LTS
  ```
- **macOS**: https://nodejs.org 의 LTS `.pkg` 설치 또는 `brew install node`
- 설치 후 **터미널(또는 VS Code)을 완전히 껐다 켜고** 확인:
  ```
  node -v
  npm -v
  ```
  `v22.x` 이상, npm 숫자가 나오면 성공입니다.

### 0-2. Git
```
git --version
git config --global user.name "깃허브닉네임"
git config --global user.email "깃허브에 등록한 이메일"
```
Windows에 Git이 없으면 https://git-scm.com 에서 설치하세요.

### 0-3. VS Code 확장 프로그램
- **Tailwind CSS IntelliSense** (클래스 자동완성 — 필수급)
- **ESLint**
- **Prettier** (선택, 팀 전원이 같이 쓰기)

### 0-4. Next.js 생성 테스트 (연습용, 끝나면 삭제)
```
npx create-next-app@latest test-app --yes
cd test-app
npm run dev
```
브라우저에서 http://localhost:3000 이 뜨면 성공. 터미널에서 `Ctrl + C`로 끄고 `test-app` 폴더는 지워도 됩니다.

> **Windows에서 `npx` 실행 시 "스크립트를 실행할 수 없으므로…" 오류가 나면**
> PowerShell 실행 정책 문제입니다. VS Code 터미널 오른쪽 `+` 옆 ▼ 에서 **Command Prompt** 또는 **Git Bash**로 바꿔 실행하면 대부분 해결됩니다.
> (PowerShell을 꼭 써야 한다면 튜터님과 함께 실행 정책을 확인하세요.)

✅ 전원 완료 기준: `node -v`, `npm -v`, `git --version` 결과 + localhost:3000 화면 캡처를 팀 채널에 공유

---

## STEP 1. 프로젝트 생성 (✅ 완료 — 참고용 기록)

> 이미 완료되어 https://github.com/KANT-2/pixel-mart 에 올라가 있습니다. **새로 만들지 말고 STEP 2부터** 진행하세요.

### 1-1. 프로젝트 만들기
```
npx create-next-app@latest pixel-mart
```
질문에는 이렇게 답합니다 (버전에 따라 질문 순서·문구가 조금 다를 수 있음):

| 질문 | 답 |
| --- | --- |
| TypeScript? | **Yes** |
| Linter? | **ESLint** |
| Tailwind CSS? | **Yes** |
| `src/` directory? | **No** |
| App Router? | **Yes** |
| Turbopack? | **Yes** |
| Customize import alias? | **No** (기본 `@/*` 사용) |
| React Compiler? | **No** |

### 1-2. 스타터 키트 복사
`pixel-mart` 폴더와 `pixel-mart-kit` 폴더가 **같은 위치**에 있다고 가정합니다.

**Git Bash / macOS**
```
cd pixel-mart
cp -r ../pixel-mart-kit/types ../pixel-mart-kit/data ../pixel-mart-kit/docs ../pixel-mart-kit/tools .
cp -r ../pixel-mart-kit/public/images public/
```

**PowerShell**
```
cd pixel-mart
Copy-Item -Recurse ..\pixel-mart-kit\types, ..\pixel-mart-kit\data, ..\pixel-mart-kit\docs, ..\pixel-mart-kit\tools .
Copy-Item -Recurse ..\pixel-mart-kit\public\images .\public\
```

### 1-3. 기본 코드 정리
1. `public/` 안의 기본 SVG(`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) 삭제 — `images/` 폴더는 남기기
2. `app/globals.css` 내용을 아래 한 줄만 남기기 (색상·폰트 테마는 2일차에 C가 추가)
   ```css
   @import "tailwindcss";
   ```
3. `app/page.tsx`를 임시 화면으로 교체 — 데이터가 잘 불러와지는지 확인용
   ```tsx
   import { products } from "@/data/products";

   export default function Home() {
     return (
       <main className="p-10">
         <h1 className="text-2xl font-bold">PIXEL MART</h1>
         <p>등록된 상품 {products.length}개</p>
       </main>
     );
   }
   ```

### 1-4. 실행 & 확인
```
npm run dev
```
- http://localhost:3000 → "등록된 상품 8개"가 보이면 OK
- http://localhost:3000/images/heart-keycap.svg → 하트 키캡 이미지가 보이면 OK (나머지 7개도 주소만 바꿔서 확인)
```
npm run build
```
- 에러 없이 끝나면 타입·데이터 규격까지 통과한 것입니다.

### 1-5. `.gitignore` 확인
`.gitignore` 파일 안에 아래 두 줄이 있는지 확인 (create-next-app이 기본으로 넣어 줍니다):
```
/node_modules
/.next/
```

### 1-6. GitHub 저장소 연결 & 초기 커밋
create-next-app이 이미 첫 커밋("Initial commit from Create Next App")을 만들어 둡니다. 그 위에 키트 내용을 커밋합니다.
```
git add .
git commit -m "chore: 상품 타입·목데이터·이미지 추가 및 기본 코드 정리"
```
GitHub 웹에서 **New repository → 이름 `pixel-mart` → README/.gitignore 추가 체크 해제(빈 저장소)** 로 만든 뒤:
```
git remote add origin https://github.com/KANT-2/pixel-mart.git
git branch -M main
git push -u origin main
```
(GitHub CLI를 쓴다면 `gh repo create pixel-mart --public --source=. --remote=origin --push` 한 줄로도 가능)

마지막으로 GitHub 저장소 **Settings → Collaborators → Add people**에서 팀원 4명을 초대합니다.

✅ B 완료 기준: 저장소 URL + 초기 커밋 URL을 팀 채널·노션에 공유

---

## STEP 2. 나머지 팀원 — 내려받아 실행
초대 메일을 수락한 뒤:
```
git clone https://github.com/KANT-2/pixel-mart.git
cd pixel-mart
npm install
npm run dev
```
localhost:3000에서 "등록된 상품 8개"가 보이면 준비 완료입니다.

---

## STEP 3. 전원 — 매일 반복하는 Git 작업 흐름
자세한 규칙은 [docs/CONVENTIONS.md](docs/CONVENTIONS.md) 참고.
```
git switch main
git pull                              # 1) 최신 main 받기
git switch -c feat/header             # 2) 내 작업 브랜치 만들기
# ... 작업 ...
git add .
git commit -m "feat: 헤더 컴포넌트 추가"  # 3) 작게, 자주 커밋
git push -u origin feat/header        # 4) 올리기
```
5) GitHub에서 **Pull Request** 생성 → 팀원 1명 확인 → **Merge** → 브랜치 삭제
6) 다른 사람 PR이 머지되면 다시 1)부터

---

## 자주 만나는 문제
| 증상 | 해결 |
| --- | --- |
| `node`/`npm` 명령을 찾을 수 없음 | Node 설치 후 터미널·VS Code를 **완전히 재시작** |
| `npx` 실행 정책 오류 (Windows) | 터미널을 Command Prompt 또는 Git Bash로 변경 |
| 3000번 포트 사용 중 | 다른 `npm run dev` 창을 끄거나, Next가 제안하는 3001 사용 |
| `Module not found: @/data/products` | 파일 위치가 프로젝트 **루트**의 `data/`인지 확인 (`app/` 안 아님) |
| 이미지가 안 보임 | `public/images/` 경로 확인, 주소는 `/images/파일명.svg` (`public`은 주소에 안 씀) |
| `git push` 거절(rejected) | `git pull` 먼저 → 충돌 해결 → 다시 push. 막히면 **바로 팀 채널에 공유** |
