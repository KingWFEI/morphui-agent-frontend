/**
 * 后端 API 统一封装
 *
 * HTTP 请求使用 /api/... 相对路径，聊天通过同源 WebSocket 连接；开发期由 Vite 代理转发到
 * FastAPI 后端（http://127.0.0.1:8000），代理配置见 vite.config.ts 的 server.proxy。
 * 接口失败时由页面显示错误，不使用模拟数据伪装成功。
 */
import type { Conversation, Message, ToolApprovalResponse, UserInfo } from "./types";

/**
 * 通用请求方法：统一携带 JSON 请求头、检查响应状态码
 * @param path 接口路径（相对路径，如 /api/health）
 * @param init 额外的 fetch 配置（method、body 等）
 * @returns 解析后的 JSON 数据
 * @throws 响应状态码非 2xx 时抛出错误（由调用方捕获处理）
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** GET /api/health 的返回结构：后端健康检查信息 */
export interface HealthInfo {
  status: string; // 服务状态，正常为 "ok"
  service: string; // 服务名，固定为 "morphui-backend"
  version: string; // 后端版本号
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface ProjectDirectory {
  name: string;
  path: string;
}

export interface ProjectBrowseResult {
  current_path: string | null;
  parent_path: string | null;
  directories: ProjectDirectory[];
  selected_path?: string;
}

function getDeviceId(): string {
  const key = "morphui-device-id";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/** 前端可调用的全部后端接口（按业务聚合） */
export interface AgentStreamEvent {
  type: string;
  [key: string]: unknown;
}

export const api = {
  /**
   * 健康检查：GET /api/health
   * App 启动后轮询该接口（15 秒一次），用于顶栏显示"后端已连接 / 未连接"状态
   */
  health: () => request<HealthInfo>("/api/health"),

  deviceId: getDeviceId,

  currentUser: (deviceId: string) =>
    request<UserInfo>(`/api/users/me?device_id=${encodeURIComponent(deviceId)}`),

  listConversations: (deviceId: string) =>
    request<Conversation[]>(`/api/conversations?device_id=${encodeURIComponent(deviceId)}`),

  createConversation: (device_id: string, title: string, project_path: string | null) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ device_id, title, project_path }),
    }),

  browseProjects: (path?: string) => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return request<ProjectBrowseResult>(`/api/projects/browse${query}`);
  },

  getConversation: (id: string, deviceId: string) =>
    request<ConversationDetail>(
      `/api/conversations/${encodeURIComponent(id)}?device_id=${encodeURIComponent(deviceId)}`,
    ),

  /**
   * 通过 WebSocket 发送聊天消息，并逐条接收智能体事件
   * @param message 用户输入的消息文本（非空）
   * @param conversationId 所属会话 ID；新对话传 null，由后端生成新 ID
   * @param onEvent 收到文本增量、工具调用等事件时的回调，同时提供当前连接的一次性审批响应函数
   * @returns reply 助手回复文本；conversation_id 后端确认的会话 ID
   */
  sendMessage: (
    message: string,
    conversationId: string | null,
    deviceId: string,
    taskId: string | null,
    onEvent: (
      event: AgentStreamEvent,
      respondToApproval: (response: ToolApprovalResponse) => boolean,
    ) => void,
    onStopReady?: (stopGeneration: () => boolean) => void,
  ) =>
    new Promise<{ reply: string; conversation_id: string }>(
      (resolve, reject) => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const socket = new WebSocket(
          `${protocol}//${window.location.host}/api/chat/ws`,
        );
        let settled = false;
        let stopRequested = false;
        let stopSent = false;
        const respondToApproval = (response: ToolApprovalResponse): boolean => {
          if (socket.readyState !== WebSocket.OPEN) return false;
          socket.send(JSON.stringify({ type: "tool_approval_response", ...response }));
          return true;
        };
        const sendStopRequest = (): void => {
          if (stopSent || socket.readyState !== WebSocket.OPEN) return;
          stopSent = true;
          socket.send(JSON.stringify({ type: "stop_request", conversation_id: conversationId }));
        };
        const stopGeneration = (): boolean => {
          if (settled || stopRequested) return false;
          stopRequested = true;
          sendStopRequest();
          return true;
        };
        onStopReady?.(stopGeneration);

        socket.onopen = () => {
          socket.send(
            JSON.stringify({
              message,
              conversation_id: conversationId,
              device_id: deviceId,
              task_id: taskId,
            }),
          );
          if (stopRequested) sendStopRequest();
        };

        socket.onmessage = (messageEvent) => {
          let event: AgentStreamEvent;
          try {
            event = JSON.parse(messageEvent.data) as AgentStreamEvent;
          } catch {
            settled = true;
            socket.close();
            reject(new Error("后端返回了无法解析的 WebSocket 消息"));
            return;
          }

          try {
            onEvent(event, respondToApproval);
          } catch (error) {
            settled = true;
            socket.close();
            reject(error);
            return;
          }
          if (event.type === "error") {
            settled = true;
            socket.close();
            reject(new Error(String(event.message ?? "智能体请求失败")));
          } else if (event.type === "complete") {
            settled = true;
            socket.close();
            resolve({
              reply: String(event.reply ?? ""),
              conversation_id: String(
                event.conversation_id ?? conversationId ?? "",
              ),
            });
          }
        };

        socket.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error("无法连接聊天 WebSocket，请确认后端服务已启动。"));
          }
        };

        socket.onclose = () => {
          if (!settled) {
            settled = true;
            reject(new Error("聊天 WebSocket 已断开，回复尚未完成。"));
          }
        };
      },
    ),
};
