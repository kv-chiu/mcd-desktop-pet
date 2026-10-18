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
export function tryExtractJson(text: string): Record<string, any> | null {
  if (!text) return null;
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 提取结构化业务字段（优先解析显式布尔字段、状态码与错误消息，拒绝仅凭缺少中文关键词推断成功）
 */
export function analyzeExplicitBusinessFields(payload: any): {
  isExplicitFailure: boolean;
  isExplicitSuccess: boolean;
  message?: string;
  code?: number | string;
} {
  if (!payload || typeof payload !== 'object') {
    return { isExplicitFailure: false, isExplicitSuccess: false };
  }

  const rawMessage =
    payload.message ||
    payload.msg ||
    payload.error?.message ||
    (typeof payload.error === 'string' ? payload.error : undefined) ||
    payload.errMsg ||
    payload.description;
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : undefined;

  // 1. 显式失败信号（例如 {"success": false, "message": "请先登录"} 或 code != 0/200）
  if (payload.success === false || payload.isError === true) {
    return { isExplicitFailure: true, isExplicitSuccess: false, message, code: payload.code };
  }
  if (
    payload.status === 'fail' ||
    payload.status === 'failed' ||
    payload.status === 'error' ||
    payload.status === 'failure'
  ) {
    return { isExplicitFailure: true, isExplicitSuccess: false, message, code: payload.code };
  }
  if (payload.error && payload.error !== false) {
    return { isExplicitFailure: true, isExplicitSuccess: false, message, code: payload.code };
  }
  if (
    payload.code !== undefined &&
    payload.code !== null &&
    payload.code !== 0 &&
    payload.code !== 200 &&
    payload.code !== '0' &&
    payload.code !== '200'
  ) {
    return { isExplicitFailure: true, isExplicitSuccess: false, message, code: payload.code };
  }
  if (
    payload.result &&
    typeof payload.result === 'object' &&
    (payload.result.success === false || payload.result.isError === true)
  ) {
    return {
      isExplicitFailure: true,
      isExplicitSuccess: false,
      message: payload.result.message || message,
      code: payload.result.code,
    };
  }
  if (payload.data && typeof payload.data === 'object' && payload.data.success === false) {
    return {
      isExplicitFailure: true,
      isExplicitSuccess: false,
      message: payload.data.message || message,
      code: payload.data.code,
    };
  }

  // 2. 显式成功信号
  if (payload.success === true) {
    return { isExplicitFailure: false, isExplicitSuccess: true, message, code: payload.code };
  }
  if (payload.status === 'success' || payload.status === 'ok') {
    return { isExplicitFailure: false, isExplicitSuccess: true, message, code: payload.code };
  }
  if (
    (payload.code === 0 || payload.code === 200 || payload.code === '0' || payload.code === '200') &&
    !payload.error
  ) {
    return { isExplicitFailure: false, isExplicitSuccess: true, message, code: payload.code };
  }

  return { isExplicitFailure: false, isExplicitSuccess: false, message, code: payload.code };
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
    // 优先解析明确业务字段（如 success, code, status, error, message），无法确认时保留未知状态
    const structuredPayload =
      tryExtractJson(rawText) ||
      (callResult?.data && typeof callResult.data === 'object' ? callResult.data : null);
    const { isExplicitFailure, isExplicitSuccess, message } = analyzeExplicitBusinessFields(structuredPayload);

    if (toolName === 'auto-bind-coupons' || toolName === 'exchange-point-coupon') {
      const stats = parseBindResultStats(rawText);

      // 检查明确的否定/失败关键词
      const hasExplicitFailureKeyword =
        rawText.includes('优惠券领取失败') ||
        rawText.includes('领取失败') ||
        rawText.includes('暂无可领取的优惠券') ||
        rawText.includes('无可领优惠券') ||
        rawText.includes('没有可领取的券') ||
        rawText.includes('未登录') ||
        rawText.includes('请先登录');

      if (isExplicitFailure) {
        business = {
          outcome: 'failure',
          summary: message || rawText.trim() || '优惠券领取失败',
          successCount: 0,
          failCount: 0,
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `主人，优惠券领取遇到问题：${business.summary}`,
        };
      } else if (stats.hasMatched) {
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
          summary: message || rawText.trim() || '优惠券领取失败',
          successCount: 0,
          failCount: 0,
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `主人，优惠券领取遇到问题：${business.summary}`,
        };
      } else if (isExplicitSuccess || rawText.includes('couponCode') || rawText.includes('img src=')) {
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
        // 未知返回或无可领券，保留未知状态
        business = {
          outcome: 'unknown',
          summary: message || rawText.trim() || '未确认优惠券领取结果',
          successCount: 0,
          failCount: 0,
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.0,
          speech: '主人，未能确认优惠券领取结果，请前往麦当劳卡包查看~',
        };
      }
    } else if (toolName === 'create-order') {
      const hasChineseFailureKeyword =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('打烊') ||
        rawText.includes('售罄') ||
        rawText.includes('不足') ||
        rawText.includes('错误') ||
        rawText.includes('未登录') ||
        rawText.includes('请先登录');

      const hasOrderSuccessEntity = Boolean(
        structuredPayload &&
          (structuredPayload.orderId ||
            structuredPayload.orderNo ||
            structuredPayload.orderNumber ||
            structuredPayload.pickupCode ||
            structuredPayload.pickUpCode ||
            structuredPayload.takeCode ||
            structuredPayload.data?.orderId ||
            structuredPayload.data?.orderNo)
      );

      const hasChineseSuccessKeyword =
        rawText.includes('订单已创建') ||
        rawText.includes('下单成功') ||
        rawText.includes('创建成功') ||
        rawText.includes('取餐码') ||
        rawText.includes('取餐号') ||
        /订单[ID号编号]+[:：\s]*[A-Za-z0-9]+/i.test(rawText);

      if (isExplicitFailure || hasChineseFailureKeyword) {
        business = {
          outcome: 'failure',
          summary: message || rawText.trim() || '订单创建失败',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `主人，下单未能成功：${business.summary}`,
        };
      } else if (isExplicitSuccess || hasOrderSuccessEntity || hasChineseSuccessKeyword) {
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
      } else {
        // 无法从结构化字段或明确凭据确认成功时，保留未知状态，绝不虚假庆祝
        business = {
          outcome: 'unknown',
          summary: message || rawText.trim() || '订单状态未知，未确认下单凭据',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: '主人，订单请求已发送，但未收到明确确认凭据，请在麦当劳 App 中核对~',
        };
      }
    } else if (toolName === 'mall-create-order') {
      const hasChineseFailureKeyword =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('不足') ||
        rawText.includes('售罄') ||
        rawText.includes('上限') ||
        rawText.includes('错误') ||
        rawText.includes('未登录') ||
        rawText.includes('请先登录');

      const hasMallSuccessEntity = Boolean(
        structuredPayload &&
          (structuredPayload.orderId ||
            structuredPayload.orderNo ||
            structuredPayload.exchangeId ||
            structuredPayload.data?.orderId ||
            structuredPayload.data?.exchangeId)
      );

      const hasChineseSuccessKeyword =
        rawText.includes('兑换成功') ||
        rawText.includes('成功兑换') ||
        rawText.includes('扣除积分') ||
        /兑换[ID号编号]+[:：\s]*[A-Za-z0-9]+/i.test(rawText);

      if (isExplicitFailure || hasChineseFailureKeyword) {
        business = {
          outcome: 'failure',
          summary: message || rawText.trim() || '积分商城兑换失败',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: `积分兑换未成功：${business.summary}`,
        };
      } else if (isExplicitSuccess || hasMallSuccessEntity || hasChineseSuccessKeyword) {
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
      } else {
        business = {
          outcome: 'unknown',
          summary: message || rawText.trim() || '积分兑换状态未知，未确认兑换结果',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.5,
          speech: '主人，积分兑换已提交，但未能确认结果，请稍后前往麦当劳 App 核对~',
        };
      }
    } else if (toolName === 'draw-lottery') {
      const hasChineseFailureKeyword =
        !rawText.trim() ||
        rawText.includes('失败') ||
        rawText.includes('已达上限') ||
        rawText.includes('积分不足') ||
        rawText.includes('已结束') ||
        rawText.includes('错误') ||
        rawText.includes('未登录') ||
        rawText.includes('请先登录');

      const hasLotterySuccessEntity = Boolean(
        structuredPayload &&
          (structuredPayload.prize ||
            structuredPayload.prizeName ||
            structuredPayload.prizes ||
            structuredPayload.award ||
            structuredPayload.lotteryResult ||
            structuredPayload.data?.prize)
      );

      const hasChineseSuccessKeyword =
        rawText.includes('恭喜获得') ||
        rawText.includes('中奖') ||
        rawText.includes('抽中') ||
        rawText.includes('抽奖成功') ||
        rawText.includes('获得好礼') ||
        rawText.includes('谢谢参与');

      if (isExplicitFailure || hasChineseFailureKeyword) {
        business = {
          outcome: 'failure',
          summary: message || rawText.trim() || '抽奖未成功',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.0,
          speech: `抽奖未成功：${business.summary}`,
        };
      } else if (isExplicitSuccess || hasLotterySuccessEntity || hasChineseSuccessKeyword) {
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
      } else {
        business = {
          outcome: 'unknown',
          summary: message || rawText.trim() || '抽奖状态未知，无法确认抽奖结果',
        };
        petFeedback = {
          shouldFeedback: true,
          action: 'idle',
          duration: 3.0,
          speech: '主人，抽奖请求已发送，请前往麦当劳 App 查看抽奖记录~',
        };
      }
    } else {
      // 查询类等常规工具：若包含明确失败指示则判定为 failure，否则 neutral
      if (isExplicitFailure) {
        business = {
          outcome: 'failure',
          summary: message || rawText.trim() || '查询失败',
        };
        petFeedback = {
          shouldFeedback: false,
          action: 'idle',
          duration: 0,
          speech: '',
        };
      } else {
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
  }

  return {
    transport,
    rpc,
    tool,
    business,
    petFeedback,
  };
}

/**
 * 判断业务结果是否属于成功范畴（完全成功、部分成功或中性状态，排除失败与未知结果）
 */
export function isBusinessSuccess(outcome?: BusinessOutcome): boolean {
  return outcome === 'full_success' || outcome === 'partial_success' || outcome === 'neutral';
}

/**
 * 统一综合判断工具执行层与业务结果层是否均成功
 */
export function isOverallSuccess(layers?: ExecutionLayers, isError?: boolean): boolean {
  if (isError) return false;
  if (!layers) return !isError;
  const isToolSuccess = layers.tool?.success !== false && !layers.tool?.isError;
  const isBizSuccess = isBusinessSuccess(layers.business?.outcome);
  return Boolean(isToolSuccess && isBizSuccess);
}
