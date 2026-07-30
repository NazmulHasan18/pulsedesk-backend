// ---------- Category payloads ----------
export interface ICreateFaqCategoryPayload {
  name: string;
}

export interface IUpdateFaqCategoryPayload {
  name?: string;
}

// ---------- Doc payloads ----------
export interface ICreateFaqDocPayload {
  question: string;
  answer: string;
  categoryId?: string; // publicId of an FaqCategory
}

export interface IUpdateFaqDocPayload {
  question?: string;
  answer?: string;
  categoryId?: string | null; // publicId of an FaqCategory, or null to unset
}

export interface IFaqSearchQuery {
  q: string;
  categoryId?: string; // publicId of an FaqCategory
  limit?: number;
}
