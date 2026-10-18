import { CategoryInfo } from '../types/mcp.js';

export const CATEGORIES: CategoryInfo[] = [
  { key: 'all', nameZh: '全部工具', nameEn: 'All Tools', icon: 'zap', description: '所有麦当劳官方 MCP 工具' },
  { key: 'coupons', nameZh: '优惠券', nameEn: 'Coupons', icon: 'ticket', description: '麦麦省券查询、一键领券及门店可用券' },
  { key: 'daily', nameZh: '日常日历', nameEn: 'Daily & Calendar', icon: 'calendar', description: '营销活动日历与系统精准时间' },
  { key: 'order', nameZh: '点餐外送', nameEn: 'Ordering & Delivery', icon: 'utensils', description: '门店查询、菜单选品、地址管理、订单创建与历史' },
  { key: 'nutrition', nameZh: '营养信息', nameEn: 'Nutrition', icon: 'activity', description: '麦当劳餐品热量、卡路里与各营养元素' },
  { key: 'mall', nameZh: '积分商城', nameEn: 'Points Mall', icon: 'coins', description: '积分账户查询、商城商品兑换及商城订单' },
  { key: 'lottery', nameZh: '积分抽奖', nameEn: 'Lottery', icon: 'sparkles', description: '积分抽奖活动、在线抽奖与我的奖品列表' },
  { key: 'party', nameZh: '主题派对', nameEn: 'Party & Events', icon: 'party-popper', description: '麦当劳生日派对、品鉴会城市门店预约与下单' },
];
