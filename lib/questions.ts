import type { ApiUser } from "@/types/api";

// 데모 입력 계약도 이 파일에 두어 #25 연결 시 한 곳에서 조정합니다.
export const questionLimits = { title: 100, content: 500 } as const;
export function validateQuestion(title: string, content: string) {
  const values = { title: title.trim(), content: content.trim() };
  const errors: { title?: string; content?: string } = {};
  if (!values.title) errors.title = "질문 제목을 입력해 주세요.";
  else if (Array.from(values.title).length > questionLimits.title) errors.title = `제목은 ${questionLimits.title}자 이내로 입력해 주세요.`;
  if (!values.content) errors.content = "질문 내용을 입력해 주세요.";
  else if (Array.from(values.content).length > questionLimits.content) errors.content = `질문은 ${questionLimits.content}자 이내로 입력해 주세요.`;
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

type Viewer = Pick<ApiUser, "id" | "nickname"> | null;
export interface QuestionInput { title: string; content: string; isSecret: boolean; }
export interface QuestionView {
  id: string;
  title: string | null;
  content: string | null;
  nickname: string | null;
  isSecret: boolean;
  hidden: boolean;
  answered: boolean;
  answer: string | null;
  createdAt: string;
}
interface StoredQuestion extends QuestionInput {
  id: string;
  userId: number;
  nickname: string;
  answer: string | null;
  createdAt: string;
}

interface QuestionsAdapter {
  mode: "demo" | "api";
  notice: string;
  list: (productId: number, viewer: Viewer, signal?: AbortSignal) => Promise<QuestionView[]>;
  create: (productId: number, viewer: Viewer, input: QuestionInput, signal?: AbortSignal) => Promise<void>;
}

// TODO(#25): 실제 GET/POST 연결과 응답→QuestionView 변환은 이 어댑터에서만 교체합니다.
export function createQuestionsAdapter(): QuestionsAdapter {
  const products = new Map<number, StoredQuestion[]>();
  let sequence = 0;
  function rows(productId: number) {
    let items = products.get(productId);
    if (!items) {
      items = [
        { id: `sample-${productId}-1`, userId: -1, nickname: "데모 플레이어", title: "상품 구성은 어디에서 확인하나요?", content: "구성품 안내를 보고 싶어요.\n이 질문은 화면을 위한 데모 데이터예요.", isSecret: false, answer: "데모 답변입니다.\n실제 상품 정보는 상품정보 탭을 확인해 주세요.", createdAt: "2026-01-02T09:00:00Z" },
        { id: `sample-${productId}-2`, userId: -2, nickname: "데모 비밀 작성자", title: "데모 비밀 질문", content: "작성자에게만 보이는 데모 질문입니다.", isSecret: true, answer: null, createdAt: "2026-01-01T09:00:00Z" },
      ];
      products.set(productId, items);
    }
    return items;
  }
  function project(item: StoredQuestion, viewer: Viewer): QuestionView {
    const hidden = item.isSecret && item.userId !== viewer?.id;
    return { id: item.id, title: hidden ? null : item.title, content: hidden ? null : item.content,
      nickname: hidden ? null : item.nickname, isSecret: item.isSecret, hidden,
      answered: item.answer !== null, answer: hidden ? null : item.answer, createdAt: item.createdAt };
  }
  return {
    mode: "demo" as const,
    notice: "데모 데이터예요. 작성한 질문은 이 화면의 메모리에만 저장되며 새로고침하면 사라져요. 실제 문의는 접수되지 않아요.",
    async list(productId: number, viewer: Viewer, signal?: AbortSignal): Promise<QuestionView[]> {
      signal?.throwIfAborted();
      return rows(productId).map((item) => project(item, viewer));
    },
    async create(productId: number, viewer: Viewer, input: QuestionInput, signal?: AbortSignal): Promise<void> {
      signal?.throwIfAborted();
      if (!viewer) throw new Error("로그인이 필요합니다");
      const result = validateQuestion(input.title, input.content);
      if (!result.valid) throw new Error(result.errors.title ?? result.errors.content);
      rows(productId).unshift({ ...result.values, isSecret: input.isSecret, id: `local-${++sequence}`, userId: viewer.id,
        nickname: viewer.nickname, answer: null, createdAt: new Date().toISOString() });
    },
  };
}

// localStorage·서버 저장 없이 새 문서가 로드되면 사라지는 브라우저 메모리입니다.
export const questions = createQuestionsAdapter();
