# 🍔 麦当劳 MCP WebUI (McDonald's MCP Web Client)

一个现代化、全功能、开箱即用的麦当劳 MCP 客户端 Web 界面。基于 React 19 + TypeScript + Vite 构建，全面对齐 [麦当劳中国官方 MCP 协议最新口径 (v1.0.9)](https://github.com/M-China/mcd-mcp-server)。

用户只需在界面中填入自己在 [麦当劳开放平台](https://open.mcd.cn/mcp) 申请的 MCP Token，即可通过 Streamable HTTP 协议直接调用全部 33 项官方工具。

---

## ✨ 核心特性

- 🚀 **全面对齐官方 33 项 MCP 工具**：涵盖营养信息、外送点餐、优惠券、积分商城、积分抽奖、主题派对与日常日历。
- 🔄 **动态工具发现与静态回退**：支持 MCP 标准 `tools/list` 实时动态同步服务端工具列表，内置完整参数规范与示例。
- ⚡ **高频常用操作一键直达**：一键自动领券、当月活动日历、我的优惠券、可用积分、营养速查、附近门店、订单历史等。
- 🎨 **智能多维结果可视化 (Visualizer)**：
  - 🕒 精准时钟卡片
  - 📅 互动日历与营销活动展示
  - 🎟️ 优惠券卡片与领券统计
  - 🥗 餐品营养热量成分网格
  - 💰 会员积分仪表盘
  - 🎡 积分抽奖活动展示
  - 📜 历史点餐与外送订单记录
  - 💻 原始 JSON 响应及一键复制
- 🛡️ **安全与体验**：MCP Token 本地保存、密码显示切换、会话 ID 自动维护、限流 (600次/分) 与 401 智能检测。

---

## 🛠️ 33 个官方工具分类一览

| 分类 | 数量 | 包含工具 |
|:---|:---:|:---|
| 🥗 **营养信息** | 1 | `list-nutrition-foods` (餐品营养信息列表) |
| 🏷️ **优惠券** | 4 | `available-coupons` (麦麦省券列表), `auto-bind-coupons` (一键领券), `query-my-coupons` (我的优惠券), `query-store-coupons` (当前门店可用券) |
| 🍔 **点餐外送** | 12 | `query-nearby-stores` (附近可用门店), `delivery-query-addresses` (配送地址列表), `delivery-create-address` (新增地址), `delivery-query-stores` (可配送门店), `query-meals` (可售餐品), `query-meal-detail` (餐品详情与替换), `query-meal-assistance` (助餐服务), `calculate-price` (算价), `create-order` (创建订单), `cancel-order` (取消订单), `query-order` (订单详情), `order-list` (历史订单) |
| 💰 **积分与商城** | 6 | `query-my-account` (我的积分查询), `mall-points-products` (商城商品列表), `mall-product-detail` (商城商品详情), `mall-create-order` (积分兑换下单), `mall-order-list` (商城订单), `mall-order-detail` (商城订单详情) |
| 🎡 **积分抽奖** | 3 | `query-lottery-info` (积分抽奖信息), `draw-lottery` (在线积分抽奖), `query-my-prizes` (我的奖品记录) |
| 🎈 **主题派对** | 5 | `query-party-city` (派对城市), `query-party-store` (派对门店), `query-partystore-date` (可预约日期), `query-partystore-session` (可预约场次), `party-order-create` (派对订单创建) |
| 📅 **日常日历** | 2 | `campaign-calendar` (营销活动日历), `now-time-info` (获取当前时间信息) |

---

## 🚀 本地开发与启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (默认端口 8080)
pnpm run dev

# 生产环境构建校验
pnpm run build
```

浏览器打开 `http://localhost:8080/` 即可体验。

---

## 📄 许可证

MIT License © 2026
