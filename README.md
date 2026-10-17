# 📝 Wizlit Editor (`@wizlit/editor`)

> **역할**: Wizlit Path 및 위즐릿 플랫폼 전역에서 사용되는 Tiptap 기반 리치 텍스트/블록 에디터 공용 컴포넌트 라이브러리  
> **기술 스택**: React 19, Next.js 15.3, TypeScript, Tiptap v2, Tailwind CSS, Storybook 8  
> **루트 설계도 SSOT**: [`references/runbooks/ARCHITECTURE.md`](../../references/runbooks/ARCHITECTURE.md) | 로컬 세팅: [`SETUP.md`](../../SETUP.md)

---

## 🚀 빠른 시작 (Quick Start)

```bash
# 의존성 설치
npm install

# 스토리북 UI 문서 및 테스트 실행 (:6006)
npm run storybook

# 프로덕션 번들 빌드
npm run build
```

---

## 🔗 프론트엔드 연동 및 로컬 개발 워크플로우

본 패키지는 독립된 컴포넌트 패키지(`@wizlit/editor`)이며, [`repos/path-next-react-frontend`](../path-next-react-frontend)에서 의존성으로 참조됩니다.

### 로컬 패키지 연동 개발 (yalc 사용)
로컬에서 에디터 코드를 수정한 후 프론트엔드 서비스에 실시간 반영할 때 사용합니다:

1. **에디터 빌드 및 로컬 발행**:
   ```bash
   npm run build
   # yalc 사용 시
   yalc publish
   ```
2. **프론트엔드 프로젝트에 반영**:
   ```bash
   cd ../path-next-react-frontend
   yalc add @wizlit/editor
   npm run dev
   ```

자세한 기여 및 디버깅 가이드는 [`DEVELOPMENT.md`](./DEVELOPMENT.md)를 참조하십시오.

---

## 🧩 주요 기능 및 컴포넌트 (`BlockEditor`)

위즐릿 맞춤형 블록 기반 에디터 인터페이스를 제공합니다:

```tsx
import { BlockEditor } from "@wizlit/editor";
import "@wizlit/editor/dist/styles/index.css";

<BlockEditor
  content={content}
  onChange={(newContent, status, stats) => setContent(newContent)}
  maxCharacters={1000}
  readOnly={false}
/>
```

### 핵심 컴포넌트 속성 (Props)
- `content`: HTML 형식의 에디터 초기 콘텐츠
- `onChange`: 내용 변경 시 콜백 (`content`, `isChanged`, `stats`)
- `readOnly`: 읽기 전용 여부
- `maxCharacters`: 최대 글자 수 제한
- `image`: 이미지 업로드 및 핸들러 커스터마이징 객체 (`maxSize`, `onUploadImage` 등)
- `link`: 링크 삽입 및 커스텀 클릭 핸들러

---

## 📂 소스 디렉토리 구조

- `src/components/`: 리치 에디터 및 툴바, 팝오버 UI 컴포넌트
- `src/extensions/`: Tiptap 커스텀 확장 기능 (코드 블록, 이미지 업로드, 수식 등)
- `src/hooks/`: 에디터 인스턴스 및 상태 관리 커스텀 훅
- `src/styles/`: 에디터 전용 테마 및 Tailwind 스타일
- `src/utils/`: 텍스트 파싱 및 헬퍼 유틸리티