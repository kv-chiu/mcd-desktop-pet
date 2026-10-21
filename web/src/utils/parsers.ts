import {
  ActivityItem,
  AvailableCouponItem,
  BindResultData,
  MyCouponItem,
  TimeData,
  NutritionItem,
  PointsAccountData,
  LotteryInfoData,
  OrderItem,
} from '../types/mcp';

export function extractTextFromResult(result: any): string {
  if (!result) return '';
  if (typeof result === 'string') return result;

  if (Array.isArray(result.content)) {
    return result.content
      .map((item: any) => (item?.type === 'text' ? item.text : JSON.stringify(item)))
      .join('\n');
  }

  if (result.text) return String(result.text);
  if (result.message) return String(result.message);

  return JSON.stringify(result, null, 2);
}

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
    }
  }

  const dateMatch = text.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/);
  const timeMatch = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  const weekMatch = text.match(/(星期[一二三四五六日天]|周[一二三四五六日天])/);
  if (dateMatch || timeMatch) {
    return {
      formatted: `${dateMatch ? dateMatch[1] : ''} ${timeMatch ? timeMatch[1] : ''}`.trim(),
      date: dateMatch ? dateMatch[1] : undefined,
      dayOfWeek: weekMatch ? weekMatch[1] : undefined,
    };
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

export function parseNutritionFoods(text: string): NutritionItem[] {
  const items: NutritionItem[] = [];

  const tableRows = text.split('\n').filter((l) => l.trim().startsWith('|') && !l.includes('---'));
  if (tableRows.length > 1) {
    for (let i = 1; i < tableRows.length; i++) {
      const cols = tableRows[i].split('|').map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        items.push({
          name: cols[0],
          energyKcal: cols[1],
          protein: cols[2] || '',
          fat: cols[3] || '',
          carbs: cols[4] || '',
          sodium: cols[5] || '',
        });
      }
    }
    if (items.length > 0) return items;
  }

  const blockRegex = /###?\s*(.+?)[\r\n]+([\s\S]*?)(?=(?:###?|$))/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const name = blockMatch[1].trim();
    const content = blockMatch[2];
    const kcal = content.match(/能量[：:]\s*([\d.]+\s*(?:kcal|千卡|kJ|千焦)?)/i)?.[1];
    const protein = content.match(/蛋白质[：:]\s*([\d.]+\s*g?)/i)?.[1];
    const fat = content.match(/脂肪[：:]\s*([\d.]+\s*g?)/i)?.[1];
    const carbs = content.match(/碳水化合物[：:]\s*([\d.]+\s*g?)/i)?.[1];
    const sodium = content.match(/钠[：:]\s*([\d.]+\s*mg?)/i)?.[1];

    if (name) {
      items.push({
        name,
        energyKcal: kcal,
        protein,
        fat,
        carbs,
        sodium,
        rawText: content.trim(),
      });
    }
  }

  return items;
}

export function parsePointsAccount(text: string): PointsAccountData {
  const avail =
    text.match(/可用积分[：:]\s*(\d+)/)?.[1] ||
    text.match(/当前积分[：:]\s*(\d+)/)?.[1] ||
    text.match(/积分[：:]\s*(\d+)/)?.[1];

  const total = text.match(/累计积分[：:]\s*(\d+)/)?.[1];
  const frozen = text.match(/冻结积分[：:]\s*(\d+)/)?.[1];
  const expiring = text.match(/(?:即将过期|年底过期)[：:]\s*(\d+)/)?.[1];
  const expireDate = text.match(/过期时间[：:]\s*([^\n\r]+)/)?.[1];

  return {
    availablePoints: avail || '0',
    totalPoints: total,
    frozenPoints: frozen,
    expiringPoints: expiring,
    expireDate,
    rawText: text,
  };
}

export function parseLotteryInfo(text: string): LotteryInfoData {
  const title = text.match(/(?:活动名称|抽奖活动)[：:]\s*([^\n\r]+)/)?.[1] || '麦当劳积分抽奖';
  const status = text.match(/状态[：:]\s*([^\n\r]+)/)?.[1] || '进行中';
  const cost = text.match(/(?:消耗积分|每次消耗)[：:]\s*(\d+)/)?.[1];
  const chances = text.match(/(?:剩余次数|可用抽奖次数)[：:]\s*(\d+)/)?.[1];

  return {
    title,
    status,
    costPoints: cost,
    remainingChances: chances,
    rawText: text,
  };
}

export function parseOrderList(text: string): OrderItem[] {
  const orders: OrderItem[] = [];
  const orderBlocks = text.split(/(?:###|\*\*订单编号|\n---)/);

  for (const block of orderBlocks) {
    const idMatch = block.match(/(?:订单(?:编号|号)?)[：:]\s*([A-Za-z0-9_-]+)/);
    if (idMatch) {
      const orderId = idMatch[1];
      const status = block.match(/状态[：:]\s*([^\n\r]+)/)?.[1]?.trim();
      const amount = block.match(/(?:实付|总额|金额)[：:]\s*¥?([\d.]+)/)?.[1];
      const time = block.match(/时间[：:]\s*([^\n\r]+)/)?.[1]?.trim();
      const store = block.match(/门店[：:]\s*([^\n\r]+)/)?.[1]?.trim();

      orders.push({
        orderId,
        status,
        totalAmount: amount ? `¥${amount}` : undefined,
        createTime: time,
        storeName: store,
        rawText: block.trim(),
      });
    }
  }

  return orders;
}
