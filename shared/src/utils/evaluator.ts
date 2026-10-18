import {
  CallToolResult,
  JsonRpcResponse,
  ExecutionLayers,
  PetFeedbackAdvice,
  BusinessStatus,
  BusinessOutcome,
  ToolExecutionStatus,
  JsonRpcStatus,
  TransportStatus,
} from '../types/mcp.js';

/**
 * 提取 MCP Result 中的主要文本内容
 */
export function extractTextFromContent(result: any): string {
  if (!result) return '';
  if (typeof result === 'string') return result;

  // 标准 MCP 工具响应: content: [{ type: 'text', text: '...' }]
  if (Array.isArray(result.content)) {
    return result.content
      .map((item: any) => (item?.type === 'text' ? item.text : typeof item === 'string' ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join('\n');
  }

  if (result.text) return String(result.text);
  if (result.message) return String(result.message);

  return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
}

/**
 * 解析优惠券领取统计
 */
export function parseBindResultStats(text: string): {
  successCount: number;
  failCount: number;
  hasMatched: boolean;
} {
  const successMatch = text.match(/(?:成功|成功领取)[：:\s]*(\d+)/);
  const failMatch = text.match(/(?:失败|失败领取)[：:\s]*(\d+)/);

  if (successMatch || failMatch) {
    return {
      successCount: successMatch ? parseInt(successMatch[1], 10) : 0,
      failCount: failMatch ? parseInt(failMatch[1], 10) : 0,
      hasMatched: true,
    };
  }

  // 匹配类似 "X张成功" / "Y张失败"
  const successMatch2 = text.match(/(\d+)\s*张成功/);
  const failMatch2 = text.match(/(\d+)\s*张失败/);
  if (successMatch2 || failMatch2) {
    return {
      successCount: successMatch2 ? parseInt(successMatch2[1], 10) : 0,
      failCount: failMatch2 ? parseInt(failMatch2[1], 10) : 0,
      hasMatched: true,
    };
  }

  return {
    successCount: 0,
    failCount: 0,
    hasMatched: false,
  };
}

export interface EvaluateLayersParams {
  toolName: string;
  args?: Record<string, any>;
  rpcResponse?: JsonRpcResponse<CallToolResult | any>;
  httpStatus?: number;
  transportError?: string;
}

/**
 * 核心评估函数：严格区分传输成功、JSON-RPC 成功、工具执行成功与业务部分成功
 * 并产出严格由实际业务结果驱动的桌宠反馈建议
 */
export function evaluateToolLayers(params: EvaluateLayersParams): ExecutionLayers & {
  petFeedback?: PetFeedbackAdvice;
} {
  const { toolName, rpcResponse, httpStatus = 200, transportError } = params;

  // 1. 传输层评估 (Transport Layer)
  const isTransportOk = !transportError && httpStatus >= 200 && httpStatus < 400;
  const transport: TransportStatus = {
    success: isTransportOk,
    status: httpStatus,
    statusText: isTransportOk ? 'OK' : 'Transport Error',
    error: transportError || (!isTransportOk ? `HTTP 状态异常: ${httpStatus}` : undefined),
  };

  // 2. JSON-RPC 协议层评估 (JSON-RPC Protocol Layer)
  let rpc: JsonRpcStatus;
  if (!isTransportOk) {
    rpc = {
      success: false,
      error: {
        code: -32000,
        message: transport.error || '传输层失败，无法进行 RPC 解析',
      },
    };
  } else if (!rpcResponse || typeof rpcResponse !== 'object' || Object.keys(rpcResponse).length === 0) {
    rpc = {
      success: false,
      error: {
        code: -32700,
        message: '未获取到有效的 JSON-RPC 响应体 (响应体为空或非对象)',
      },
    };
  } else if (rpcResponse.error) {
    rpc = {
      success: false,
      id: rpcResponse.id,
      error: rpcResponse.error,
    };
  } else if (!('result' in rpcResponse) || rpcResponse.result === undefined) {
    rpc = {
      success: false,
      id: rpcResponse.id,
      error: {
        code: -32600,
        message: '无效的 JSON-RPC 响应结构：缺少 result 或 error 字段',
      },
    };
  } else {
    rpc = {
      success: true,
      id: rpcResponse.id,
    };
  }

  // 3. 工具执行层评估 (Tool Execution Layer - MCP tools/call)
  let tool: ToolExecutionStatus;
  const callResult = rpcResponse?.result;
  const isToolError = Boolean(callResult?.isError);
  const rawText = callResult ? extractTextFromContent(callResult) : '';

  if (!rpc.success) {
    tool = {
      success: false,
      isError: true,
      toolName,
      error: rpc.error?.message || 'RPC 调用未成功，工具未执行',
    };
  } else if (!callResult || typeof callResult !== 'object' || !Array.isArray(callResult.content)) {
    tool = {
      success: false,
      isError: true,
      toolName,
      error: '工具调用返回结果结构无效 (缺少 content 数组)',
    };
  } else if (isToolError) {
    tool = {
      success: false,
      isError: true,
      toolName,
      content: callResult.content,
      rawText,
      error: rawText || '工具返回执行错误 (result.isError: true)',
    };
  } else {
    tool = {
      success: true,
      isError: false,
      toolName,
      content: callResult.content,
      rawText,
    };
  }

  // 4. 业务结果层评估 (Business Outcome Layer - 业务实际结果)
  let business: BusinessStatus;
  let petFeedback: PetFeedbackAdvice | undefined;

  if (!tool.success) {
    // 工具层已失败，业务必然失败
    business = {
      outcome: 'failure',
      summary: tool.error || '工具执行失败',
      detail: rawText,
    };

    // 失败反馈：绝不能有成功庆祝！
    if (toolName === 'auto-bind-coupons' || toolName === 'exchange-point-coupon') {
      petFeedback = {
        shouldFeedback: true,
        action: 'idle',
        duration: 3.5,
        speech: `主人，优惠券领取遇到问题：${business.summary}`,
      };
    } else if (toolName === 'create-order') {
      petFeedback = {
        shouldFeedback: true,
        action: 'idle',
        duration: 3.5,
        speech: `主人，下单遇到问题了：${business.summary}`,
      };
    } else {
      petFeedback = {
        shouldFeedback: false,
        action: 'idle',
        duration: 2.0,
        speech: '',
      };
    }
  } else {
    // 工具层执行成功 (isError === false)，进一步深度分析业务实际结果
    if (toolName === 'auto-bind-coupons' || toolName === 'exchange-point-coupon') {
      const stats = parseBindResultStats(rawText);

      // 检查明确的否定/失败关键词
      const hasExplicitFailureKeyword =
        rawText.includes('优惠券领取失败') ||
        rawText.includes('领取失败') ||
        rawText.includes('暂无可领取的优惠券') ||
        rawText.includes('无可领优惠券') ||
        rawText.includes('没有可领取的券');

      if (stats.hasMatched) {
        if (stats.successCount > 0 && stats.failCount === 0) {
          // 全部成功
          business = {
            outcome: 'full_success',
            summary: `成功领取全部 ${stats.successCount} 张优惠券`,
            successCount: stats.successCount,
            failCount: 0,
            totalCount: stats.successCount,
          };
          petFeedback = {
            shouldFeedback: true,
            action: 'jump',
            duration: 3.5,
            speech: '主人！麦当劳优惠券已全部为您自动领取好啦！🎉',
          };
        } else if (stats.successCount > 0 && stats.failCount > 0) {
          // 部分成功
          business = {
            outcome: 'partial_success',
            summary: `部分成功：已领取 ${stats.successCount} 张，${stats.failCount} 张未成功`,
            successCount: stats.successCount,
            failCount: stats.failCount,
            totalCount: stats.successCount + stats.failCount,
          };
          petFeedback = {
            shouldFeedback: true,
            action: 'wave',
            duration: 3.5,
            speech: `主人，为您领取了 ${stats.successCount} 张优惠券，还有 ${stats.failCount} 张未成功哦~🎫`,
          };
        } else {
          // 成功数为 0
          business = {
            outcome: 'failure',
            summary: stats.failCount > 0 ? `领取失败：共 ${stats.failCount} 张未能领取` : '本次未能领取到优惠券',
            successCount: 0,
            failCount: stats.failCount,
            totalCount: stats.failCount,
          };
          petFeedback = {
            shouldFeedback: true,
            action: 'idle',
            duration: 3.5,
            speech: `主人，优惠券未能领取成功（可能已达上限或暂无可领券）`,
          };
        }
      } else if (hasExplicitFailureKeyword) {
        business = {
          outcome: 'failure',
          summary: rawText.trim() || '优惠券领取失败',
          successCount: 0,
          failCount: 0,
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `主人，优惠券领取遇到问题：${business.summary}`,
        };
      } else if (rawText.includes('couponCode') || rawText.includes('img src=')) {
        // 返回了优惠券卡片内容，判定为完全成功
        business = {
          outcome: 'full_success',
          summary: '优惠券已成功领入卡包',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'jump',
          duration: 3.5,
          speech: '主人！麦当劳优惠券已全部为您自动领取好啦！🎉',
        };
      } else {
        // 未知返回或无可领券
        business = {
          outcome: 'failure',
          summary: rawText.trim() || '暂无可领取的优惠券',
          successCount: 0,
          failCount: 0,
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.0,
          speech: '主人，当前没有可领取的优惠券哦~',
        };
      }
    } else if (toolName === 'create-order') {
      const isFailedOrder =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('打烊') ||
        rawText.includes('售罄') ||
        rawText.includes('不足') ||
        rawText.includes('错误');

      if (isFailedOrder) {
        business = {
          outcome: 'failure',
          summary: rawText.trim() || '订单创建失败：未返回有效订单内容',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `主人，下单未能成功：${business.summary}`,
        };
      } else {
        business = {
          outcome: 'full_success',
          summary: '订单已成功创建',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'wave',
          duration: 4.0,
          speech: '订单已创建！麦麦美味正在加速准备中~🍔',
        };
      }
    } else if (toolName === 'mall-create-order') {
      const isFailedMallOrder =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('不足') ||
        rawText.includes('售罄') ||
        rawText.includes('上限');

      if (isFailedMallOrder) {
        business = {
          outcome: 'failure',
          summary: rawText.trim() || '积分商城兑换失败：未返回有效兑换内容',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `积分兑换未成功：${business.summary}`,
        };
      } else {
        business = {
          outcome: 'full_success',
          summary: '积分商品兑换成功',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'jump',
          duration: 3.5,
          speech: '积分商品兑换成功啦！🎁',
        };
      }
    } else if (toolName === 'draw-lottery') {
      const isFailedLottery =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('已达上限') ||
        rawText.includes('积分不足') ||
        rawText.includes('已结束');

      if (isFailedLottery) {
        business = {
          outcome: 'failure',
          summary: rawText.trim() || '抽奖未成功：未返回有效抽奖结果',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.0,
          speech: `抽奖未成功：${business.summary}`,
        };
      } else {
        business = {
          outcome: 'full_success',
          summary: '抽奖完成',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'jump',
          duration: 3.5,
          speech: '抽奖完成！快看看抽中了什么好礼吧~✨',
        };
      }
    } else {
      // 查询类工具等常规工具
      business = {
        outcome: 'neutral',
        summary: '执行完成',
      };
      petFeedback = {
        shouldFeedback: false,
        action: 'idle',
        duration: 0,
        speech: '',
      };
    }
  }

  return {
    transport,
    rpc,
    tool,
    business,
    petFeedback,
  };
}
