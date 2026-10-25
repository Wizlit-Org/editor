# 📝 Wizlit Editor (`@wizlit/editor`)

> **역할**: Wizlit Path 및 위즐릿 플랫폼 전역에서 사용되는 TipTap 2.x 기반 노션(Notion)형 리치 블록 에디터 라이브러리  
> **UI 디자인**: Apple VisionOS / 노션 등급의 리얼 프로스티드 글라스모피즘 (`backdrop-filter: blur(24px) saturate(160%)`, 다크/라이트 테마 자동 동기화)  
> **아키텍처**: 호스트 프레임워크와 완전히 분리된 100% 독립 실행형(Standalone Isolation) 컴포넌트 패키지  
> **기술 스택**: React 19, TypeScript, TipTap v2, Tailwind CSS, browser-image-compression  

---

## 🚀 빠른 시작 (Quick Start)

### 설치 및 로컬 빌드
```bash
# 의존성 설치
npm install

# 번들 빌드 (DTS, CJS, ESM + Tailwind CSS)
npm run build

# 로컬 패키지 발행 (Yalc)
npx yalc publish
```

### 프론트엔드 호스트 프로젝트 연동
```bash
# 호스트 앱 디렉토리에서 로컬 패키지 연결
npx yalc link @wizlit/editor

# 실시간 변경점 즉시 반영 (에디터 디렉토리에서 실행)
npx yalc push --sig
```

---

## 🧩 기본 사용법 (Usage)

```tsx
import { BlockEditor } from '@wizlit/editor'
import '@wizlit/editor/dist/styles/index.css'

export function MyEditor() {
  const [content, setContent] = useState('<p>안녕하세요!</p>')

  return (
    <BlockEditor
      content={content}
      onChange={(newContent, status, stats) => setContent(newContent)}
      readOnly={false}
      maxCharacters={5000}
      image={{
        maxSize: 5 * 1024 * 1024,
        onUploadImage: async (file) => {
          // 서버 업로드 로직 구현
          return 'https://cdn.example.com/images/uploaded.png'
        },
        // [선택] Next.js BFF 프록시 사용 시 주입 (미제공 시 순수 원본 URL 직접 fetch)
        imageProxyUrl: (url) => `/api/image-proxy?url=${encodeURIComponent(url)}`,
      }}
    />
  )
}
```

---

## 💎 117 트랙 핵심 기능 명세 (Feature Specifications)

### 1. 스마트 테이블 (Smart Table)
- **오버플로우 스크롤 & 점진적 림 블러 마스크 (`TableScrollIndicator`)**:
  - 가로 폭을 초과하는 대형 테이블 렌더링 시 브라우저 레이아웃 깨짐을 방지하고 부드러운 가로 스크롤 제공.
  - 양 끝단 스크롤 위치에 따라 실시간 `linear-gradient` 투명 안개 림 블러 마스크가 동적으로 발현되어 시각적 몰입감 극대화.
- **행/열 알약형 그립 (`RowHandle`, `ColHandle`)**:
  - 마우스 호버 시 테이블 외곽에 알약형 글라스 캡슐 그립이 즉시 표출되어 직관적인 행/열 선택 및 순서 드래그 지원.
- **다중 셀 드래그 선택 & 클러스터 이동**:
  - 마우스 드래그로 복수 셀/행/열 클러스터를 일괄 선택하여 복사, 삭제 및 데이터 재배치 가능.
- **헤더 가로지르기 방어 (Header Straddle Protection)**:
  - 헤더 행(`th`)과 본문 행(`td`) 간의 비정상적 병합 또는 드래그 이동을 0ms 단위로 감지하여 테이블 스키마 파괴 원천 방어.
- **컨텍스트 메뉴 & 퀵 추가 버튼 (`TableAddButtons`, `TableMenu`)**:
  - 행/열 추가, 셀 분할, 정렬 및 배경색 지정 등 프로스티드 글라스 팝오버 메뉴 완비.

### 2. 스마트 붙여넣기 다이얼로그 (Smart Paste Preview Dialog)
- **5단 수직 중앙 정렬 리얼 글라스모피즘 독**:
  - **[1단]**: 타이틀 (`붙여넣기 형식 선택`) 및 선택된 삽입 방식 1줄 설명 (크로스페이드 텍스트).
  - **[2단]**: 제목 바로 밑 선택지 플로팅 글라스 독 탭 (`role="tablist"`, 텍스트 / 링크 / 외부 이미지 / 이미지 업로드 / 유튜브 / 코드 / 목록).
  - **[3단]**: 박스 테두리 틀 없는 에디터 1:1 실시간 미리보기 (`LivePreviewCanvas`) + 초과 시 부드러운 Scale 자동 축소.
  - **[4단]**: 미니 글라스 캡슐 단축키 안내 뱃지 (`<kbd>←</kbd> <kbd>→</kbd>` 옵션 전환 · `<kbd>↵</kbd>` 삽입 · `<kbd>Esc</kbd>` 취소).
  - **[5단]**: 최하단 중앙 나란히 배치된 `[취소]`(프로스티드 글라스) + `[삽입 ↵]`(인디고 광택 글라스) 액션 버튼.
- **이중 GPU 가속 애니메이션 (Dual Animation Engine)**:
  - **등장**: 다이얼로그 마운트 시 전체 블러 오버레이와 내부 3단 섹션이 260ms cubic-bezier(0.16, 1, 0.3, 1)로 스케일업(0.96->1) 및 페이드인 등장.
  - **퇴장**: 삽입/취소 시 200ms cubic-bezier(0.4, 0, 0.2, 1) 디졸브 소멸 (블러 연산 플리커를 차단하기 위해 고정 블러 유지 후 순수 Alpha Opacity 페이드아웃).
  - **미리보기 전환**: 탭 변경 시 220ms 크로스페이드+미세 스케일/슬라이드 모핑 전환.
- **키보드 & IME 입력 원천 차단 (Keyboard Guard & Focus Lock)**:
  - 캡처 단계(`capture: true`) `keydown` 트랩: 허용된 단축키(`Tab`, `ArrowLeft`, `ArrowRight`, `Enter`, `Escape`) 외 모든 키 이벤트 전파 차단.
  - CJK 한글 조합 누출 방어: 다이얼로그 활성 시점에 `editor.setEditable(false)` 적용 및 `beforeinput`, `compositionstart` 이벤트를 전면 차단하고, 다이얼로그 컨테이너로 포커스 격리(`editor.view.dom.blur()`). 삽입 실행 직전에 `editor.setEditable(true)`로 원상 복원하여 본문 글자 침범 100% 방지.

### 3. 리치 링크 미리보기 (Rich Link Preview)
- 링크 삽입 시 OpenGraph 메타데이터 카드가 인라인 블록으로 렌더링되며, 클릭 시 인터랙티브 링크 편집 패널 지원.

### 4. 미디어 & 업로드 큐 (Media & Upload Queue)
- **YouTube 블록**: 동영상 URL 감지 시 전용 글라스 다이얼로그 및 본문 인터랙티브 플레이어 블록 삽입.
- **0ms 스켈레톤 업로드 큐 (`ImageUploadQueue`)**:
  - 이미지 파일/드롭/클립보드 붙여넣기 시 0ms 지연 없이 즉시 프로그레스 스켈레톤 위젯 데코레이션 마운트.
  - `browser-image-compression` 기반 웹 워커 최적화 및 업로드 진행률 상태 관리.
- **ImageBlockView 자체 뱃지 렌더링**:
  - 호스트 프레임워크의 임의 DOM 주입 없이 노드뷰 자체에서 '외부 이미지' 상태를 100% 안전하게 시각화.

### 5. 하단 텍스트 메뉴 & Esc 가드 (Bottom TextMenu & Esc Guard)
- **하단 글라스 TextMenu**: 텍스트 선택 시 뷰포트 하단에 미려한 프로스티드 글라스 툴바 도킹 (서식, 굵기, 색상, 링크, 정렬).
- **Esc Guard (`useEditorEscGuard`)**: 다층 모달/팝오버 환경에서 Esc 입력 시 [다이얼로그 닫기 ➔ 팝오버 메뉴 닫기 ➔ 버블 메뉴 닫기 ➔ 호스트 모달 닫기] 순서로 계층형 이벤트 격리.

---

## ⚙️ Props & Options 레퍼런스 (API Reference)

### `BlockEditorProps`
| 프로퍼티 | 타입 | 기본값 | 설명 |
| :--- | :--- | :---: | :--- |
| `content` | `string` | `''` | 에디터 초기 HTML 콘텐츠 |
| `onChange` | `(html: string, status: { isChanged: boolean; isStrictChanged: boolean }, stats: EditorStats) => void` | `undefined` | 문서 변경 시 실시간 콜백 |
| `readOnly` | `boolean` | `false` | 읽기 전용 모드 토글 |
| `theme` | `'light' \| 'dark'` | `'light'` | 에디터 테마 (다크모드/라이트모드) |
| `maxCharacters` | `number` | `5000` | 최대 허용 글자 수 제한 |
| `maxEmbeddings` | `number` | `3` | 최대 허용 외부 임베드/미디어 수 제한 |
| `altCharacterCounter` | `boolean` | `false` | 공백 제외 글자 수 카운터 모드 활성화 |
| `image` | `ImageProps` | `{}` | 이미지 업로드, 프록시, 리사이즈 옵션 객체 (하단 참조) |
| `link` | `LinkProps` | `{}` | 하이퍼링크 동작 제어 옵션 객체 |

### `image` 옵션 세부 규격 (`ImageProps`)
| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :---: | :--- |
| `maxSize` | `number` | `5MB` | 업로드 허용 최대 파일 크기 (바이트) |
| `onUploadImage` | `(file: File) => Promise<string>` | 데모 핸들러 | 이미지 서버 업로드 비동기 핸들러 |
| `imageProxyUrl` | `(url: string) => string` | `undefined` | 외부 이미지 CORS 우회를 위한 프록시 URL 변환 함수 |
| `convertSrc` | `(src: string) => string \| Promise<string>` | `undefined` | 본문 이미지 src 경로 변환 핸들러 (커스텀 프로토콜 등) |
| `disableBuiltInUploadDialog` | `boolean` | `false` | 기본 업로드 진행 상태 다이얼로그 숨김 여부 |
| `onClick` | `(event: MouseEvent, node: Node) => void` | `undefined` | 이미지 클릭 커스텀 핸들러 |
| `onLoadingChange` | `(hasUploading: boolean) => void` | `undefined` | 백그라운드 이미지 업로드 진행 상태 감지 콜백 |

---

## 🌐 독립 실행(Standalone) vs 프록시 연동 가이드

`@wizlit/editor`는 호스트 프레임워크에 종속되지 않고 완전히 독립적으로 동작할 수 있도록 설계되었습니다.

### 모드 A. 순수 독립 실행 (Standalone Mode - 기본값)
- `image.imageProxyUrl`을 전달하지 않으면 에디터 라이브러리는 외부 BFF 프록시 의존성을 일체 요구하지 않습니다.
- 원본 이미지 URL로 직접 CORS fetch를 시도하며, 브라우저 Canvas fallback을 통해 안전하게 이미지를 처리합니다:
```tsx
<BlockEditor
  content={content}
  image={{
    onUploadImage: myUploadApi,
    // imageProxyUrl 생략 시 100% 독립 동작
  }}
/>
```

### 모드 B. Next.js BFF 프록시 연동 (Proxy Accelerated Mode)
- Next.js API Routes 또는 사내 이미지 프록시 백엔드가 준비되어 있는 경우, `imageProxyUrl` 옵션을 주입하여 외부 도메인의 CORS 제약을 100% 우회할 수 있습니다:
```tsx
<BlockEditor
  content={content}
  image={{
    onUploadImage: myUploadApi,
    imageProxyUrl: (url) => `/api/image-proxy?url=${encodeURIComponent(url)}`,
  }}
/>
```

---

## 📁 디렉토리 구조 (Directory Layout)

```
.repos/editor/
├── src/
│   ├── components/
│   │   ├── BlockEditor/           # 메인 BlockEditor 컴포넌트
│   │   └── menus/
│   │       ├── PastePreviewDialog/# 스마트 붙여넣기 5단 다이얼로그 및 LivePreviewCanvas
│   │       ├── TextMenu/          # 하단 플로팅 텍스트 서식 메뉴
│   │       ├── LinkMenu/          # 리치 링크 미리보기 및 편집 메뉴
│   │       └── ContentItemMenu/   # 드래그 핸들 및 블록 추가 메뉴
│   ├── extensions/
│   │   ├── Table/                 # 스마트 테이블 확장 및 림 블러 스크롤, 그립 핸들
│   │   ├── ImageBlock/            # 이미지 블록 뷰 및 자체 뱃지 렌더러
│   │   ├── ImageUpload/           # 0ms 스켈레톤 업로드 큐 및 압축 엔진
│   │   ├── YoutubeBlock/          # 유튜브 임베드 및 다이얼로그
│   │   └── extension-kit.ts       # Tiptap 확장 패키지 통합 번들러
│   ├── hooks/
│   │   ├── useBlockEditor.ts      # 에디터 인스턴스 초기화 및 단축키/이벤트 파이프라인
│   │   └── useEditorEscGuard.ts   # 계층형 Esc 단축키 격리 가드
│   └── styles/                    # 리얼 글라스모피즘 스타일 및 전역 CSS
└── tsup.config.ts                 # 프로덕션 번들 빌드 설정 (DTS / ESM / CJS)

### 💡 Gotchas
- **비교 기준선(`baselineHTMLRef`) 스냅샷 정합화**: 마운트·모드 전환 시 `Heading` UUID 주입 및 `TrailingNode` 추가로 인한 거짓 `isChanged: true` 발화를 막기 위해 `onCreate` 및 `setContent` 직후의 `editor.getHTML()` 스냅샷을 기준선으로 삼고 `setEditable(_editable, false)` 및 `preventUpdate` 메타를 적용함.
```
