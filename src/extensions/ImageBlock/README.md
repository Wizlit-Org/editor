# 🖼️ `src/extensions/ImageBlock/`

> 🎯 **목적**: TipTap 에디터 기반 이미지 블록 확장, 다크 네이비 쉬머 스켈레톤 로딩 및 읽기/리비전 뷰어 연동  
> 🧭 **단일 원천(SSOT)**: [`/AGENTS.md`](/AGENTS.md)

---

## 1. 파일 구성

| 파일명 | 역할 및 핵심 스펙 |
| :--- | :--- |
| `ImageBlock.ts` | TipTap Node 확장 정의 (src, align, width 속성, 드래그 핸들, 커맨드 파이프라인) |
| `index.ts` | ImageBlock 모듈 엔트리포인트 및 타입 내보내기 |
| `components/ImageBlockView.tsx` | 이미지 렌더링 노드 뷰 (다크 네이비 스켈레톤 쉬머, 캐시 판별, FLIP 클릭 확대, 리비전 뷰 연동) |
| `components/ImageBlockMenu.tsx` | 에디터 내부 이미지 선택 시 표시되는 플로팅 정렬/너비 메뉴 |
| `components/ImageBlockWidth.tsx` | 이미지 너비 조절 인라인 슬라이더/버튼 컴포넌트 |

---

## 2. 관문 라우팅 표

| 🎯 발동 트리거 (상황/키워드) | 🛑 필수 열람 대상 | 핵심 기준 (확인 암호) |
| :--- | :--- | :--- |
| 이미지 로딩 중 깜빡임/CLS 방지 | `ImageBlockView.tsx` | 다크 네이비 16:9 쉬머 스켈레톤(`image-skeleton-navy`) 유지 |
| 리비전 모달 / 읽기 전용 뷰어 연동 | `ImageBlockView.tsx` | `!editorEditable` 시 `onImageClick` 위임 및 모달 팝업 연동 |
| 이미지 URL 변환 및 비동기 프리페치 | `ImageBlockView.tsx` | `convertSrc` 파이프라인 및 `EXTERNAL_IMAGE` 판별 로직 확인 |
| 이미지 정렬 및 너비 제어 툴바 | `ImageBlockMenu.tsx` | 좌/중앙/우 정렬 및 너비 비율 변경 커맨드 점검 |

---

## 3. 핵심 규칙 및 Gotchas

1. **다크 네이비 쉬머 스켈레톤 UI (CLS 방지)**:
   - 이미지가 네트워크를 통해 비동기로 로드되거나 S3 서명 URL을 변환하는 동안 16:9 비율의 다크 네이비(`#080F3B`) 쉬머 애니메이션을 표출하여 레이아웃 시프트(CLS)를 0px로 방어함.
2. **읽기 전용 및 리비전 뷰어 모드 (`!editorEditable`)**:
   - 편집 모드가 아닐 때(`editor.isEditable === false`) 이미지를 클릭하면 편집 커맨드 대신 `onImageClick` 콜백을 트리거하여 상위 리비전 뷰어 또는 이미지 다이얼로그(`ImageDialog`)로 즉시 연결함.
3. **이미지 캐시 즉시 인식 (`complete`)**:
   - 브라우저 메모리에 기캐싱된 이미지는 `img.complete && img.naturalWidth > 0`을 통해 즉시 `loaded: true`로 전환하여 불필요한 스켈레톤 깜빡임을 제거함.
