import { Editor } from '@tiptap/react'

export const getRenderContainer = (editor: Editor, nodeType: string): HTMLElement | null => {
  const {
    view,
    state: {
      selection: { from },
    },
  } = editor

  if (!view || !view.dom) return null

  const matchesTarget = (el: Element | null): el is HTMLElement => {
    if (!el || !(el instanceof HTMLElement)) return false
    if (el.getAttribute('data-type') === nodeType) return true
    if (el.classList?.contains(nodeType)) return true
    return false
  }

  const findTargetInOrSelf = (el: Element | null): HTMLElement | null => {
    if (!el || !(el instanceof HTMLElement)) return null
    if (matchesTarget(el)) return el
    const found = el.querySelector<HTMLElement>(`.${nodeType}, [data-type="${nodeType}"]`)
    if (found) return found
    return null
  }

  // 1순위: ProseMirror view.nodeDOM(from) 직통 검사 (NodeSelection 시 가장 정확한 DOM 노드)
  try {
    const nodeDom = view.nodeDOM(from)
    const found = findTargetInOrSelf(nodeDom as Element)
    if (found) return found
  } catch {
    // ignore
  }

  // 2순위: .ProseMirror-selectednode 선택 노드 검사
  const selectedNode = view.dom.querySelector('.ProseMirror-selectednode')
  const foundFromSelected = findTargetInOrSelf(selectedNode)
  if (foundFromSelected) return foundFromSelected

  // 3순위: .has-focus 포커스 요소 검사
  const elements = view.dom.querySelectorAll('.has-focus')
  if (elements.length > 0) {
    const innermost = elements[elements.length - 1]
    const foundFromFocus = findTargetInOrSelf(innermost)
    if (foundFromFocus) return foundFromFocus
  }

  // 4순위: domAtPos(from)의 childNodes 검사 (NodeSelection 시 부모 컨테이너 내 대상 자식)
  try {
    const domAt = view.domAtPos(from)
    if (domAt.node) {
      if (domAt.node.childNodes && domAt.node.childNodes[domAt.offset]) {
        const child = domAt.node.childNodes[domAt.offset]
        const foundFromChild = findTargetInOrSelf(child as Element)
        if (foundFromChild) return foundFromChild
      }
      const foundFromDomAt = findTargetInOrSelf(domAt.node as Element)
      if (foundFromDomAt) return foundFromDomAt
    }
  } catch {
    // ignore
  }

  // 5순위: 기존 상위 parentElement 탐색 (텍스트 셀렉션 / 인라인 노드 시)
  try {
    let container: HTMLElement | null = view.domAtPos(from).node as HTMLElement
    if (container && !container.tagName) {
      container = container.parentElement
    }
    while (container && container !== view.dom) {
      if (matchesTarget(container)) return container
      container = container.parentElement
    }
  } catch {
    // ignore
  }

  // 6순위: 에디터 돔 전체에서 셀렉터 단독 조회 폴백
  return view.dom.querySelector<HTMLElement>(`.${nodeType}, [data-type="${nodeType}"]`)
}

export default getRenderContainer
