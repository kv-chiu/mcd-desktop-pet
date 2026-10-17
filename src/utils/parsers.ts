import {
  ActivityItem,
  AvailableCouponItem,
  BindResultData,
  MyCouponItem,
  TimeData,
} from '../types/mcp';

export function parseTimeData(structured: any, text: string): TimeData | null {
  if (structured?.data) {
    return structured.data;
  }
  const match = text.match(/"data":\s*(\{[^}]+\})/s);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].replace(/\n/g, ''));
      return parsed;
    } catch {
      // ignore
    }
  }
  return null;
}

export function parseCalendarData(text: string): Record<string, ActivityItem[]> {
  const data: Record<string, ActivityItem[]> = {};
  const dateRegex = /####?\s*(?:(\d+)年)?(\d+)月(\d+)日/g;
  let match: RegExpExecArray | null;
  const sections: Array<{
    year: number;
    month: number;
    day: number;
    content: string;
  }> = [];
  let lastIndex = 0;

  while ((match = dateRegex.exec(text)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].content = text.slice(lastIndex, match.index);
    }
    sections.push({
      year: match[1] ? parseInt(match[1], 10) : new Date().getFullYear(),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10),
      content: '',
    });
    lastIndex = match.index + match[0].length;
  }

  if (sections.length > 0) {
    sections[sections.length - 1].content = text.slice(lastIndex);
  }

  sections.forEach((s) => {
    const key = `${s.year}-${s.month}-${s.day}`;
    const activities = parseActivities(s.content);
    if (activities.length > 0) {
      data[key] = activities;
    }
  });

  return data;
}

export function parseActivities(text: string): ActivityItem[] {
  const activities: ActivityItem[] = [];
  const regex =
    /\*\*活动标题\*\*[：:]\s*(.+?)\\[\s\S]*?\*\*活动内容介绍\*\*[：:]\s*([\s\S]*?)(?:\*\*活动图片介绍\*\*[\s\S]*?<img src="([^"]+)")?(?=\n-\s*\*\*活动标题|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    activities.push({
      title: match[1].trim(),
      content: match[2].replace(/\\n/g, '\n').replace(/\\/g, '').trim(),
      img: match[3] || '',
    });
  }
  return activities;
}

export function parseAvailableCoupons(text: string): AvailableCouponItem[] {
  const coupons: AvailableCouponItem[] = [];
  const regex =
    /优惠券标题[：:]\s*(.+?)[\s\n\\]+状态[：:]\s*(.+?)[\s\n\\]+[\s\S]*?<img src="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    coupons.push({
      title: match[1].trim(),
      status: match[2].trim(),
      img: match[3],
    });
  }
  return coupons;
}

export function parseMyCoupons(text: string): { count: string; coupons: MyCouponItem[] } {
  const countMatch = text.match(/共\s*(\d+)\s*张/);
  const count = countMatch ? countMatch[1] : '0';

  const coupons: MyCouponItem[] = [];
  // 匹配 **优惠**: ¥数字 和 **有效期**: 格式
  const regex =
    /##\s*(.+?)[\n\r][\s\S]*?\*\*优惠\*\*:\s*¥?(\d+(?:\.\d+)?)[^\n]*[\s\S]*?\*\*有效期\*\*:\s*([^\n]+)[\s\S]*?(?:\*\*标签\*\*:\s*([^\n]+))?[\s\S]*?<img src="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    coupons.push({
      title: match[1].trim(),
      price: match[2],
      validity: match[3].trim(),
      tags: match[4] ? match[4].split('、') : [],
      img: match[5],
    });
  }

  if (!coupons.length) {
    const simpleRegex = /##\s*(.+?)[\n\r][\s\S]*?<img src="([^"]+)"/g;
    while ((match = simpleRegex.exec(text)) !== null) {
      coupons.push({
        title: match[1].trim(),
        img: match[2],
        price: '',
        validity: '',
        tags: [],
      });
    }
  }

  return { count, coupons };
}

export function parseValidityDates(validity: string): { start: Date; end: Date } | null {
  if (!validity) return null;
  // 格式: 2026-01-15 00:00-2026-01-21 23:59 或 2026-01-19 10:45-2026-01-23 23:59 周一、二...
  const match = validity.match(/(\d{4}-\d{2}-\d{2})[^-]*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;

  const start = new Date(match[1]);
  const end = new Date(match[2]);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function parseBindResult(text: string): BindResultData {
  const successMatch = text.match(/成功[：:]\s*(\d+)/);
  const failMatch = text.match(/失败[：:]\s*(\d+)/);

  const success = successMatch ? successMatch[1] : '0';
  const fail = failMatch ? failMatch[1] : '0';
  const isAllSuccess = parseInt(fail, 10) === 0 && parseInt(success, 10) > 0;

  const coupons: Array<{ title: string; code: string; img: string }> = [];
  const regex = /\*\*(.+?)\*\*[\s\S]*?couponCode[：:]\s*(\w+)[\s\S]*?<img src="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    coupons.push({
      title: match[1],
      code: match[2],
      img: match[3],
    });
  }

  return {
    success,
    fail,
    isAllSuccess,
    coupons,
  };
}
