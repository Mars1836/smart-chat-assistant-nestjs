/**
 * Định dạng card chung cho response chat.
 * FE render một loại card (product, article, link) với: ảnh (nếu có), title, mô tả, bấm vào mở url.
 * Mở rộng: thêm type mới (video, event, ...) và metadata tương ứng.
 */
export interface ChatCard {
  /** Loại card: product | article | link. FE có thể style khác nhau theo type. */
  type: 'product' | 'article' | 'link';

  /** Tiêu đề hiển thị (bắt buộc). */
  title: string;

  /** Mô tả ngắn (tùy chọn). */
  description?: string;

  /** URL ảnh (tùy chọn). */
  imageUrl?: string;

  /** Link khi bấm vào card (bắt buộc). */
  url: string;

  /** Dữ liệu bổ sung tùy type: giá, brand, author, ngày, ... */
  metadata?: Record<string, any>;
}
