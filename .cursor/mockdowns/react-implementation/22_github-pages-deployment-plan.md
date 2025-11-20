# GitHub Pages 자동 배포 계획

## 📋 목표

GitHub Pages에 자동 배포를 설정하여 `main` 브랜치에 푸시될 때마다 자동으로 배포되도록 구성합니다.

**배포 링크**: https://jumoooo.github.io/front_7th_chapter2-2/

## 🔍 현재 상태 분석

### ✅ 이미 구현된 부분

1. **Base Path 설정**
   - `packages/app/vite.config.ts`: 프로덕션 환경에서 `/front_7th_chapter2-2/` base path 설정 ✅
   - `packages/app/src/constants.js`: `BASE_URL`이 프로덕션에서 `/front_7th_chapter2-2/`로 설정 ✅
   - ✅ **확인 완료**: 배포 링크와 코드의 base path가 일치함 (언더스코어 `_` 사용)

2. **빌드 스크립트**
   - `package.json`에 `gh-pages` 스크립트 존재: `"gh-pages": "pnpm -F @hanghae-plus/shopping build && gh-pages -d ./packages/app/dist"`
   - `gh-pages` 패키지가 이미 설치되어 있음

3. **404 페이지 처리**
   - `packages/app/404.html` 파일 존재
   - Vite 빌드 설정에 404.html이 포함되어 있음

### ❌ 미구현 부분

1. **GitHub Actions 워크플로우**: 자동 배포를 위한 CI/CD 파이프라인 없음

## 📝 작업 계획

### 1단계: Base Path 확인

#### 1.1 배포 링크 확인

- 배포 링크: `https://jumoooo.github.io/front_7th_chapter2-2/`
- 실제 경로: `/front_7th_chapter2-2/` (언더스코어 사용)

#### 1.2 코드 확인 결과

- ✅ `packages/app/vite.config.ts`: 이미 `/front_7th_chapter2-2/`로 올바르게 설정됨
- ✅ `packages/app/src/constants.js`: 이미 `/front_7th_chapter2-2/`로 올바르게 설정됨
- **수정 불필요**: Base path가 이미 올바르게 설정되어 있음

### 2단계: GitHub Actions 워크플로우 생성

#### 2.1 워크플로우 파일 생성

- 경로: `.github/workflows/deploy.yml`
- 트리거: `main` 브랜치에 푸시될 때

#### 2.2 워크플로우 단계

1. **체크아웃**: 소스 코드 체크아웃
2. **Node.js 설정**: Node.js 22+ 및 pnpm 설정
3. **의존성 설치**: `pnpm install`
4. **테스트 실행**:
   - 단위 테스트: `pnpm test`
   - E2E 테스트: `pnpm test:e2e` (선택적, 시간이 오래 걸릴 수 있음)
5. **빌드**: `pnpm -F @hanghae-plus/shopping build`
6. **배포**: `gh-pages`를 사용하여 `gh-pages` 브랜치에 배포

#### 2.3 워크플로우 구조

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install
      - run: pnpm test
      - run: pnpm -F @hanghae-plus/shopping build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./packages/app/dist
```

### 3단계: 테스트 검증

#### 3.1 로컬 빌드 테스트

- `pnpm -F @hanghae-plus/shopping build` 실행
- `packages/app/dist` 폴더 확인
- `vite preview`로 로컬에서 빌드 결과 확인

#### 3.2 Base Path 테스트

- 빌드된 파일의 경로가 올바른지 확인
- `index.html`의 asset 경로 확인
- 라우터가 올바른 base path를 사용하는지 확인

#### 3.3 테스트 코드 통과 확인

- `pnpm test`: 단위 테스트 통과 확인
- `pnpm test:e2e`: E2E 테스트 통과 확인 (로컬 환경에서)

### 4단계: 배포 및 검증

#### 4.1 초기 배포

- GitHub Actions 워크플로우 실행
- `gh-pages` 브랜치 생성 확인
- 배포된 사이트 접속하여 기능 확인

#### 4.2 기능 검증

- 홈 페이지 로드 확인
- 라우팅 동작 확인
- 상품 목록 표시 확인
- 검색 기능 확인
- 장바구니 기능 확인

## ⚠️ 주의사항

### 테스트 코드 수정 금지

- `e2e/e2e.spec.js`: 수정하지 않음
- `packages/react/src/__tests__/`: 수정하지 않음
- 테스트 코드는 기존 그대로 유지

### 기존 기능 유지

- 모든 기존 기능이 정상 작동해야 함
- 라우팅, 상태 관리, 이벤트 핸들러 등 모든 기능 유지

### Base Path 일관성

- ✅ 배포 링크와 코드의 base path가 이미 일치함 (`/front_7th_chapter2-2/`)

## 📦 필요한 변경 파일

### 수정할 파일

- 없음 (Base path는 이미 올바르게 설정되어 있음)

### 생성할 파일

1. `.github/workflows/deploy.yml`: GitHub Actions 워크플로우

### 수정하지 않을 파일

- `e2e/e2e.spec.js`: 수정 금지
- `packages/react/src/__tests__/`: 수정 금지
- 기타 테스트 파일: 수정 금지

## 🔄 배포 프로세스

1. **개발자가 코드 수정 및 커밋**
2. **main 브랜치에 푸시**
3. **GitHub Actions 자동 실행**
   - 소스 코드 체크아웃
   - 의존성 설치
   - 테스트 실행
   - 빌드 실행
   - gh-pages 브랜치에 배포
4. **배포 완료** (약 2-3분 소요)
5. **사이트 접속 확인**: https://jumoooo.github.io/front-7th-chapter2-2/

## ✅ 검증 체크리스트

- [x] Base path가 올바르게 설정되었는지 확인 (이미 올바르게 설정됨)
- [ ] 로컬 빌드가 성공하는지 확인
- [ ] 단위 테스트가 통과하는지 확인
- [ ] E2E 테스트가 통과하는지 확인 (로컬)
- [ ] GitHub Actions 워크플로우가 정상 실행되는지 확인
- [ ] 배포된 사이트가 정상 작동하는지 확인
- [ ] 라우팅이 올바르게 작동하는지 확인
- [ ] 모든 기능이 정상 작동하는지 확인

## 👤 사용자가 직접 해야 할 작업 (외부 설정)

### ⚠️ 중요: 다음 작업들은 코드 수정이 아닌 GitHub 웹사이트에서 직접 설정해야 합니다

#### 1. GitHub 저장소 설정 확인

1. **GitHub 저장소 접속**
   - 저장소 URL: `https://github.com/jumoooo/front-7th-chapter2-2` (또는 실제 저장소 URL)
   - 저장소가 존재하고 접근 가능한지 확인

2. **저장소 권한 확인**
   - Settings > General > Danger Zone에서 저장소 설정 확인
   - Actions 권한이 활성화되어 있는지 확인

#### 2. GitHub Pages 설정

1. **Settings > Pages 메뉴 접속**
   - 저장소의 Settings 탭 클릭
   - 왼쪽 메뉴에서 "Pages" 클릭

2. **Source 설정**
   - Source: `Deploy from a branch` 선택
   - Branch: `gh-pages` 선택 (워크플로우가 생성한 브랜치)
   - Folder: `/ (root)` 선택
   - Save 클릭

3. **Custom domain 설정 (선택사항)**
   - 필요시 커스텀 도메인 설정 가능
   - 현재는 `jumoooo.github.io/front_7th_chapter2-2/` 사용

#### 3. GitHub Actions 권한 설정

1. **Settings > Actions > General 접속**
   - 저장소의 Settings > Actions > General 메뉴로 이동

2. **Workflow permissions 설정**
   - "Workflow permissions" 섹션 확인
   - "Read and write permissions" 선택
   - "Allow GitHub Actions to create and approve pull requests" 체크 (필요시)
   - Save 버튼 클릭

3. **Actions 권한 확인**
   - Actions 탭에서 워크플로우가 실행 가능한지 확인
   - 필요시 조직/저장소 레벨에서 Actions가 활성화되어 있는지 확인

#### 4. GITHUB_TOKEN 확인

- GitHub Actions에서 자동으로 제공되는 `GITHUB_TOKEN` 사용
- 별도로 생성할 필요 없음 (워크플로우에서 자동 사용)
- 만약 권한 문제가 발생하면:
  - Settings > Actions > General에서 권한 확인
  - Personal Access Token 생성 필요 여부 확인

#### 5. 초기 배포 확인

1. **워크플로우 실행 확인**
   - 코드 푸시 후 Actions 탭에서 워크플로우 실행 확인
   - 빌드 및 배포 로그 확인

2. **gh-pages 브랜치 확인**
   - Code 탭에서 브랜치 목록 확인
   - `gh-pages` 브랜치가 생성되었는지 확인
   - 브랜치에 배포 파일이 올바르게 있는지 확인

3. **배포 사이트 접속 확인**
   - `https://jumoooo.github.io/front_7th_chapter2-2/` 접속
   - 사이트가 정상적으로 로드되는지 확인
   - 기능이 정상 작동하는지 확인

#### 6. 문제 해결 (필요시)

1. **배포 실패 시**
   - Actions 탭에서 실패한 워크플로우 클릭
   - 로그 확인하여 에러 원인 파악
   - 필요시 코드 수정 후 재푸시

2. **사이트가 404 에러인 경우**
   - GitHub Pages 설정 확인
   - `gh-pages` 브랜치가 올바르게 설정되었는지 확인
   - Base path가 올바른지 확인

3. **권한 에러인 경우**
   - Settings > Actions > General에서 권한 확인
   - 조직 저장소인 경우 관리자에게 권한 요청

## 📌 다음 단계 (작업 순서)

### 개발자(AI)가 할 작업

1. ✅ Base path 확인 완료 (이미 올바르게 설정됨)
2. GitHub Actions 워크플로우 파일 생성 (`.github/workflows/deploy.yml`)
3. 로컬 빌드 및 테스트 검증

### 사용자가 할 작업 (외부 설정)

4. **GitHub 저장소 설정 확인** (위의 "1. GitHub 저장소 설정 확인" 참조)
5. **GitHub Pages 설정** (위의 "2. GitHub Pages 설정" 참조)
6. **GitHub Actions 권한 설정** (위의 "3. GitHub Actions 권한 설정" 참조)

### 공동 작업

7. **코드 푸시 및 배포 테스트**
   - 개발자가 코드를 main 브랜치에 푸시
   - 사용자가 Actions 탭에서 워크플로우 실행 확인
   - 사용자가 gh-pages 브랜치 생성 확인
   - 사용자가 배포된 사이트 접속하여 기능 검증

8. **배포 검증 및 문제 해결**
   - 배포된 사이트 기능 확인
   - 문제 발생 시 위의 "6. 문제 해결" 참조
