import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|api[_-]?key|authorization|credential|refreshToken|accessToken)/i;

function sanitizeHtmlString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(iframe|object|embed|applet|meta|link)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(href|src|xlink:href)\s*=\s*(['"]?)\s*(javascript|vbscript):[^'">\s]*\2/gi,
      '',
    );
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeHtmlString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      sanitized[nestedKey] = sanitizeValue(nestedValue, nestedKey);
    }
    return sanitized;
  }

  return value;
}

@Injectable()
export class HtmlSanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (!['body', 'query', 'param'].includes(metadata.type)) {
      return value;
    }

    return sanitizeValue(value);
  }
}
