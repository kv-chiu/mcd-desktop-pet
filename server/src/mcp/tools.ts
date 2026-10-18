import { MCPToolSchema } from './types.js';

export interface ToolCatalogItem extends MCPToolSchema {
  id: string;
  nameZh: string;
  nameEn: string;
  category: 'nutrition' | 'coupons' | 'daily' | 'order' | 'mall' | 'lottery' | 'party';
  categoryZh: string;
  aliases?: string[];
  exampleArgs?: Record<string, any>;
}

export const OFFICIAL_TOOLS: ToolCatalogItem[] = [
  // 1. 营养信息
  {
    id: 'list-nutrition-foods',
    name: 'list-nutrition-foods',
    nameZh: '餐品营养信息列表',
    nameEn: 'Food Nutrition Information List',
    description: '获取麦当劳常见餐品的营养成分数据，包括能量、蛋白质、脂肪、碳水化合物、钠、钙等信息。',
    category: 'nutrition',
    categoryZh: '营养信息',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '餐品关键词，如：汉堡 / 麦辣鸡翅 / 薯条' },
      },
    },
    exampleArgs: { keyword: '汉堡' },
  },

  // 2. 点餐与外送
  {
    id: 'delivery-query-addresses',
    name: 'delivery-query-addresses',
    nameZh: '获取配送地址列表',
    nameEn: 'Get Delivery Address List',
    description: '查询用户已创建的配送地址列表，用于外送点餐时选择配送地址。',
    category: 'order',
    categoryZh: '点餐与外送',
  },
  {
    id: 'delivery-create-address',
    name: 'delivery-create-address',
    nameZh: '新增配送地址',
    nameEn: 'Add Delivery Address',
    description: '创建新的可配送地址。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: '收货地址' },
        name: { type: 'string', description: '收货人姓名' },
        phone: { type: 'string', description: '手机号' },
        sex: { type: 'string', description: '性别: M / F' },
      },
      required: ['address', 'name', 'phone'],
    },
  },
  {
    id: 'delivery-query-stores',
    name: 'delivery-query-stores',
    nameZh: '查询配送可用门店',
    nameEn: 'Query Delivery Stores',
    description: '根据地址或经纬度查询支持外送的麦当劳门店。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        addressId: { type: 'string', description: '配送地址ID' },
        latitude: { type: 'number', description: '纬度' },
        longitude: { type: 'number', description: '经度' },
      },
    },
  },
  {
    id: 'query-meal-assistance',
    name: 'query-meal-assistance',
    nameZh: '点餐辅助信息',
    nameEn: 'Meal Assistance Info',
    description: '获取当前餐段（早餐、正餐、下午茶、夜宵）与基础点餐指引。',
    category: 'order',
    categoryZh: '点餐与外送',
  },
  {
    id: 'query-nearby-stores',
    name: 'query-nearby-stores',
    nameZh: '附近门店查询',
    nameEn: 'Query Nearby Stores',
    description: '根据经纬度查询附近的麦当劳门店及营业状态。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: '纬度' },
        longitude: { type: 'number', description: '经度' },
      },
      required: ['latitude', 'longitude'],
    },
    exampleArgs: { latitude: 31.2304, longitude: 121.4737 },
  },
  {
    id: 'query-store-coupons',
    name: 'query-store-coupons',
    nameZh: '门店可用卡券列表',
    nameEn: 'Query Store Coupons',
    description: '查询特定门店当前可使用的麦麦优惠券。',
    category: 'coupons',
    categoryZh: '优惠券',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
      },
      required: ['storeId'],
    },
  },
  {
    id: 'query-meals',
    name: 'query-meals',
    nameZh: '查询菜单商品列表',
    nameEn: 'Query Menu Meals',
    description: '获取门店完整在售菜单及分类商品。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
        orderType: { type: 'number', description: '取餐类型: 0到店自取, 1外送' },
      },
      required: ['storeId'],
    },
  },
  {
    id: 'query-meal-detail',
    name: 'query-meal-detail',
    nameZh: '查询单品餐品详情',
    nameEn: 'Query Meal Detail',
    description: '获取特定商品的定制选项、配料及价格详情。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
        productId: { type: 'string', description: '商品ID' },
      },
      required: ['storeId', 'productId'],
    },
  },
  {
    id: 'calculate-price',
    name: 'calculate-price',
    nameZh: '计算订单价格',
    nameEn: 'Calculate Order Price',
    description: '提交商品与优惠券计算最终应付金额及减免优惠明细。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
        items: { type: 'array', description: '选购商品数组' },
        couponIds: { type: 'array', description: '使用的卡券ID列表' },
      },
      required: ['storeId', 'items'],
    },
  },
  {
    id: 'create-order',
    name: 'create-order',
    nameZh: '创建麦当劳订单',
    nameEn: 'Create Order',
    description: '创建麦当劳点餐或外送正式订单。',
    category: 'order',
    categoryZh: '点餐与外送',
  },
  {
    id: 'cancel-order',
    name: 'cancel-order',
    nameZh: '取消订单',
    nameEn: 'Cancel Order',
    description: '在订单未制作完成前申请取消订单。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: '订单号' },
      },
      required: ['orderId'],
    },
  },
  {
    id: 'query-order',
    name: 'query-order',
    nameZh: '查询单笔订单详情',
    nameEn: 'Query Order Detail',
    description: '根据订单ID查询状态、取餐码、骑手配送状态。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: '订单ID' },
      },
      required: ['orderId'],
    },
  },
  {
    id: 'order-list',
    name: 'order-list',
    nameZh: '历史订单列表',
    nameEn: 'Order List',
    description: '分页获取用户的历史订餐记录。',
    category: 'order',
    categoryZh: '点餐与外送',
    inputSchema: {
      type: 'object',
      properties: {
        pageNo: { type: 'number', description: '页码' },
        pageSize: { type: 'number', description: '每页条数' },
      },
    },
  },

  // 3. 日常与日历
  {
    id: 'campaign-calendar',
    name: 'campaign-calendar',
    nameZh: '营销活动日历',
    nameEn: 'Campaign Calendar',
    description: '获取麦当劳月度营销与优惠活动日历（如会员日、半价活动日）。',
    category: 'daily',
    categoryZh: '日常日历',
    aliases: ['campaign-calender'],
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: '月份，格式 YYYY-MM' },
      },
    },
  },
  {
    id: 'now-time-info',
    name: 'now-time-info',
    nameZh: '当前时间与餐段状态',
    nameEn: 'Current Time & Meal Phase',
    description: '获取麦当劳系统标准时间及当前对应餐段。',
    category: 'daily',
    categoryZh: '日常日历',
  },

  // 4. 优惠券
  {
    id: 'available-coupons',
    name: 'available-coupons',
    nameZh: '可领取优惠券列表',
    nameEn: 'Available Coupons',
    description: '获取麦当劳当前全网可领取的优惠券列表。',
    category: 'coupons',
    categoryZh: '优惠券',
  },
  {
    id: 'auto-bind-coupons',
    name: 'auto-bind-coupons',
    nameZh: '一键自动领券',
    nameEn: 'Auto Bind Coupons',
    description: '批量自动将所有当前可领取的卡券绑定到用户账户中。',
    category: 'coupons',
    categoryZh: '优惠券',
  },
  {
    id: 'query-my-coupons',
    name: 'query-my-coupons',
    nameZh: '我的卡券包列表',
    nameEn: 'My Coupons',
    description: '查询用户账户中已拥有的所有有效优惠券与折扣券。',
    category: 'coupons',
    categoryZh: '优惠券',
    aliases: ['my-coupons'],
  },

  // 5. 积分与会员
  {
    id: 'query-my-account',
    name: 'query-my-account',
    nameZh: '会员账户与积分查询',
    nameEn: 'My Account & Points',
    description: '查询当前用户的会员等级、可用积分及基础信息。',
    category: 'mall',
    categoryZh: '积分商城',
  },
  {
    id: 'mall-points-products',
    name: 'mall-points-products',
    nameZh: '积分商城可兑换商品',
    nameEn: 'Points Mall Products',
    description: '获取积分商城支持兑换的卡券和周边实物。',
    category: 'mall',
    categoryZh: '积分商城',
    inputSchema: {
      type: 'object',
      properties: {
        pageNo: { type: 'number', description: '页码' },
        pageSize: { type: 'number', description: '每页条数' },
      },
    },
  },
  {
    id: 'mall-product-detail',
    name: 'mall-product-detail',
    nameZh: '积分商品详情',
    nameEn: 'Points Product Detail',
    description: '查询积分商城指定商品的兑换规则与所需积分。',
    category: 'mall',
    categoryZh: '积分商城',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: '商品ID' },
      },
      required: ['productId'],
    },
  },
  {
    id: 'mall-create-order',
    name: 'mall-create-order',
    nameZh: '积分商品兑换下单',
    nameEn: 'Exchange Points Product',
    description: '消耗积分兑换卡券或实物商品。',
    category: 'mall',
    categoryZh: '积分商城',
  },
  {
    id: 'mall-order-list',
    name: 'mall-order-list',
    nameZh: '积分兑换订单列表',
    nameEn: 'Points Order List',
    description: '查询用户的历史积分兑换订单列表。',
    category: 'mall',
    categoryZh: '积分商城',
  },
  {
    id: 'mall-order-detail',
    name: 'mall-order-detail',
    nameZh: '积分订单详情',
    nameEn: 'Points Order Detail',
    description: '查看单笔积分兑换记录与核销码。',
    category: 'mall',
    categoryZh: '积分商城',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: '积分订单号' },
      },
      required: ['orderId'],
    },
  },

  // 6. 积分抽奖
  {
    id: 'query-lottery-info',
    name: 'query-lottery-info',
    nameZh: '积分抽奖活动详情',
    nameEn: 'Lottery Info',
    description: '查询进行中的积分抽奖活动、规则与奖品池。',
    category: 'lottery',
    categoryZh: '积分抽奖',
  },
  {
    id: 'draw-lottery',
    name: 'draw-lottery',
    nameZh: '在线参与积分抽奖',
    nameEn: 'Draw Lottery',
    description: '消耗积分参与在线转盘抽奖。',
    category: 'lottery',
    categoryZh: '积分抽奖',
  },
  {
    id: 'query-my-prizes',
    name: 'query-my-prizes',
    nameZh: '我的中奖记录',
    nameEn: 'My Prizes',
    description: '查看抽奖获得的所有奖品及领取状态。',
    category: 'lottery',
    categoryZh: '积分抽奖',
  },

  // 7. 主题派对
  {
    id: 'query-party-city',
    name: 'query-party-city',
    nameZh: '派对开放城市列表',
    nameEn: 'Party Cities',
    description: '查询支持举办麦麦派对的城市列表。',
    category: 'party',
    categoryZh: '主题派对',
  },
  {
    id: 'query-party-store',
    name: 'query-party-store',
    nameZh: '派对承办门店查询',
    nameEn: 'Party Stores',
    description: '查询城市内支持举办派对的麦当劳餐厅。',
    category: 'party',
    categoryZh: '主题派对',
    inputSchema: {
      type: 'object',
      properties: {
        cityId: { type: 'string', description: '城市编码' },
      },
      required: ['cityId'],
    },
  },
  {
    id: 'query-partystore-date',
    name: 'query-partystore-date',
    nameZh: '门店派对可预约日期',
    nameEn: 'Party Available Dates',
    description: '查询门店派对空余预约日期。',
    category: 'party',
    categoryZh: '主题派对',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
      },
      required: ['storeId'],
    },
  },
  {
    id: 'query-partystore-session',
    name: 'query-partystore-session',
    nameZh: '门店派对可约场次',
    nameEn: 'Party Available Sessions',
    description: '查询特定日期的空闲派对场次与时间段。',
    category: 'party',
    categoryZh: '主题派对',
    inputSchema: {
      type: 'object',
      properties: {
        storeId: { type: 'string', description: '门店ID' },
        date: { type: 'string', description: '预约日期 YYYY-MM-DD' },
      },
      required: ['storeId', 'date'],
    },
  },
  {
    id: 'party-order-create',
    name: 'party-order-create',
    nameZh: '提交派对预定订单',
    nameEn: 'Create Party Order',
    description: '完成麦当劳生日派对或品鉴会预约下单。',
    category: 'party',
    categoryZh: '主题派对',
  },
];

export const TOOL_MAP = new Map<string, ToolCatalogItem>(
  OFFICIAL_TOOLS.map((t) => [t.id, t])
);

export function normalizeToolName(toolName: string): string {
  if (toolName === 'campaign-calender') return 'campaign-calendar';
  if (toolName === 'my-coupons') return 'query-my-coupons';
  return toolName;
}
