import type { ChatCard } from '../../common/interfaces/chat-card.interface';

export type CardMapperContext = {
  shopFrontendUrl?: string;
};

/** Cấu hình đánh dấu action của plugin trả về list → hiển thị card (chỉ map khi có config này). */
export type CardConfig = {
  enabled?: boolean;
  list_path?: string;
  field_mapping?: Record<string, string>;
};

/**
 * Tool trả về sẵn result.cards (ChatCard[]) → dùng luôn.
 */
export function getCardsFromResult(result: any): ChatCard[] | null {
  if (result && Array.isArray(result.cards) && result.cards.length > 0) {
    return result.cards.filter(isValidCard);
  }
  return null;
}

function isValidCard(c: any): c is ChatCard {
  return c && typeof c.type === 'string' && typeof c.title === 'string' && typeof c.url === 'string';
}

/**
 * Map danh sách sản phẩm (shop API) → ChatCard[] type 'product'.
 */
export function mapProductListToCards(
  products: any[],
  ctx: CardMapperContext,
): ChatCard[] {
  if (!Array.isArray(products) || products.length === 0) return [];
  const base = ctx.shopFrontendUrl || '';
  return products.map((p) => ({
    type: 'product' as const,
    title: p.name || p.title || 'Sản phẩm',
    description: p.description || undefined,
    imageUrl: Array.isArray(p.images) ? p.images[0] : p.images,
    url: base && p.slug
      ? `${base.replace(/\/$/, '')}/product.html?slug=${p.slug}`
      : (p.url || (p.slug ? `product.html?slug=${p.slug}` : '#')),
    metadata: {
      id: p.id,
      slug: p.slug,
      brand: p.brand,
      price: p.price,
    },
  }));
}

/**
 * Map kết quả tìm kiếm (SerpApi organic_results, hoặc mảng { title, link, snippet }) → ChatCard[] type 'link'.
 */
export function mapSearchResultsToCards(items: any[]): ChatCard[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    type: 'link' as const,
    title: item.title || item.name || 'Link',
    description: item.snippet || item.description || undefined,
    imageUrl: item.image_url || item.thumbnail || undefined,
    url: item.link || item.url || item.href || '#',
    metadata: {
      displayLink: item.display_link,
      position: item.position,
    },
  }));
}

/**
 * Map danh sách bài viết / bài báo (title, url, description, image, author, date) → ChatCard[] type 'article'.
 */
export function mapArticleListToCards(items: any[]): ChatCard[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    type: 'article' as const,
    title: item.title || item.name || 'Bài viết',
    description: item.description || item.excerpt || item.snippet || undefined,
    imageUrl: item.imageUrl || item.image_url || item.thumbnail || item.cover || undefined,
    url: item.url || item.link || item.href || '#',
    metadata: {
      author: item.author,
      publishedAt: item.publishedAt || item.date || item.published_at,
      source: item.source,
    },
  }));
}

/** Các key thường gặp để lấy title / url / image / description (tool khách hàng có thể trả về khác tên) */
const TITLE_KEYS = ['title', 'name', 'heading', 'label'];
const URL_KEYS = ['url', 'link', 'href', 'detailUrl', 'permalink'];
const IMAGE_KEYS = ['imageUrl', 'image', 'thumbnail', 'cover', 'thumb', 'avatar'];
const DESC_KEYS = ['description', 'snippet', 'excerpt', 'summary', 'content'];

function pickFirst(obj: any, keys: string[], fieldMapping?: Record<string, string>): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const toTry = fieldMapping ? keys.map((k) => fieldMapping[k] ?? k).filter(Boolean) : keys;
  for (const k of toTry) {
    const v = obj[k];
    if (v != null && typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  if ((fieldMapping?.imageUrl ?? 'image') === 'image' || keys.includes('image')) {
    const arr = obj.images ?? obj.image_list;
    if (Array.isArray(arr) && arr[0]) {
      const v = arr[0];
      return typeof v === 'string' ? v : undefined;
    }
  }
  return undefined;
}

function inferCardType(item: any): ChatCard['type'] {
  if (item.type === 'product' || item.type === 'article' || item.type === 'link') return item.type;
  if (item.slug != null || (typeof item.price === 'number' && !Number.isNaN(item.price))) return 'product';
  if (item.author != null || item.publishedAt != null || item.published_at != null) return 'article';
  return 'link';
}

/**
 * Map mảng bất kỳ (API khách hàng trả về) → ChatCard[].
 * Dùng field_mapping từ card_config nếu có (title→name, url→link, ...); không thì dùng key chuẩn.
 */
export function mapGenericListToCards(
  items: any[],
  ctx: CardMapperContext,
  fieldMapping?: Record<string, string>,
): ChatCard[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const base = ctx.shopFrontendUrl || '';
  return items.map((item) => {
    const title = pickFirst(item, TITLE_KEYS, fieldMapping) || '—';
    let url = pickFirst(item, URL_KEYS, fieldMapping) || '#';
    const imageUrl = pickFirst(item, IMAGE_KEYS, fieldMapping);
    const description = pickFirst(item, DESC_KEYS, fieldMapping);
    const type = inferCardType(item);

    if (type === 'product' && base && item.slug && (!url || url === '#')) {
      url = `${base.replace(/\/$/, '')}/product.html?slug=${item.slug}`;
    } else if (type === 'product' && item.slug && (!url || url === '#')) {
      url = `product.html?slug=${item.slug}`;
    }

    const usedKeys = new Set([
      ...TITLE_KEYS.map((k) => fieldMapping?.[k] ?? k),
      ...URL_KEYS.map((k) => fieldMapping?.[k] ?? k),
      ...IMAGE_KEYS.map((k) => fieldMapping?.[k] ?? k),
      ...DESC_KEYS.map((k) => fieldMapping?.[k] ?? k),
      'type',
      'images',
      'image_list',
    ]);
    const metadata: Record<string, any> = {};
    if (item && typeof item === 'object') {
      for (const [k, v] of Object.entries(item)) {
        if (usedKeys.has(k) || k.startsWith('_')) continue;
        if (v !== undefined && v !== null) metadata[k] = v;
      }
    }
    return {
      type,
      title,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      url,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    };
  });
}

/** Lấy mảng từ result. Nếu list_path cho trước (từ card_config) thì chỉ lấy theo path đó; không thì thử data/items/results/... */
function getListFromResult(result: any, listPath?: string): any[] | null {
  if (!result) return null;
  if (Array.isArray(result)) return result;
  if (listPath) {
    const parts = listPath.trim().split('.');
    let cur: any = result;
    for (const p of parts) {
      cur = cur?.[p];
    }
    return Array.isArray(cur) ? cur : null;
  }
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.results)) return result.results;
  if (Array.isArray(result.organic_results)) return result.organic_results;
  if (Array.isArray(result.list)) return result.list;
  return null;
}

/**
 * Build ChatCard[] chỉ khi action có card_config (plugin đánh dấu).
 * Lấy list theo list_path → map theo field_mapping (hoặc key chuẩn).
 */
export function buildCardsFromToolResults(
  calls: Array<{ name: string }>,
  results: any[],
  ctx: CardMapperContext,
  options?: { cardConfigByCall?: Map<string, CardConfig> },
): ChatCard[] {
  const cardConfigByCall = options?.cardConfigByCall;
  if (!cardConfigByCall) return [];

  for (let i = 0; i < calls.length; i++) {
    const result = results[i];
    const callName = calls[i].name;
    const cardConfig = cardConfigByCall.get(callName);
    if (!cardConfig || cardConfig.enabled === false) continue;

    const list = getListFromResult(result, cardConfig.list_path);
    if (list && list.length > 0) {
      const cards = mapGenericListToCards(list, ctx, cardConfig.field_mapping);
      if (cards.length > 0) return cards;
    }
  }
  return [];
}
