import { NextRequest, NextResponse } from "next/server";
import { createClient, WebDAVClient } from "webdav";

interface WebDAVProxyRequest {
  config: {
    serverUrl: string;
    username: string;
    password: string;
  };
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

// 支持的 WebDAV 方法
const SUPPORTED_METHODS = ["GET", "PUT", "DELETE", "POST", "PROPFIND", "MKCOL"];

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join("/");

    // 处理代理请求
    if (path === "proxy-request") {
      const body: WebDAVProxyRequest = await request.json();
      const {
        config,
        method,
        path: targetPath,
        body: requestBody,
        headers,
      } = body;

      // 验证必需的配置
      if (!config.serverUrl || !config.username || !config.password) {
        return NextResponse.json(
          { error: "缺少必需的 WebDAV 配置信息" },
          { status: 400 }
        );
      }

      // 验证方法
      if (!SUPPORTED_METHODS.includes(method.toUpperCase())) {
        return NextResponse.json(
          { error: `不支持的方法: ${method}` },
          { status: 405 }
        );
      }

      // 创建 WebDAV 客户端
      const client: WebDAVClient = createClient(config.serverUrl, {
        username: config.username,
        password: config.password,
      });

      // 构建完整路径
      const fullPath = targetPath.startsWith("/")
        ? targetPath
        : `/${targetPath}`;

      // 根据方法执行相应操作
      let result;
      switch (method.toUpperCase()) {
        case "GET":
          if (targetPath.endsWith("/") || !targetPath.includes(".")) {
            // 目录列表
            result = await client.getDirectoryContents(fullPath);
          } else {
            // 文件内容
            result = await client.getFileContents(fullPath, { format: "text" });
          }
          break;

        case "PUT":
          result = await client.putFileContents(fullPath, requestBody || "");
          break;

        case "DELETE":
          result = await client.deleteFile(fullPath);
          break;

        case "PROPFIND":
          result = await client.stat(fullPath);
          break;

        case "MKCOL":
          result = await client.createDirectory(fullPath);
          break;

        default:
          return NextResponse.json(
            { error: `方法 ${method} 尚未实现` },
            { status: 501 }
          );
      }

      return NextResponse.json({
        success: true,
        data: result,
        method,
        path: fullPath,
      });
    }

    // 如果不是代理请求，返回错误
    return NextResponse.json({ error: "不支持的请求路径" }, { status: 404 });
  } catch (error) {
    console.error("WebDAV 代理错误:", error);

    const errorMessage = error instanceof Error ? error.message : "未知错误";
    const status = getErrorStatus(error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status }
    );
  }
}

// 连接测试专用端点
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join("/");

  // 特殊处理连接测试
  if (path === "test-connection") {
    try {
      const { searchParams } = new URL(request.url);
      const serverUrl = searchParams.get("serverUrl");
      const username = searchParams.get("username");
      const password = searchParams.get("password");

      if (!serverUrl || !username || !password) {
        return NextResponse.json({ error: "缺少连接参数" }, { status: 400 });
      }

      const client: WebDAVClient = createClient(serverUrl, {
        username,
        password,
      });

      // 测试连接
      await client.getDirectoryContents("/");

      return NextResponse.json({
        success: true,
        message: "连接测试成功",
      });
    } catch (error) {
      console.error("WebDAV 连接测试失败:", error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "连接失败",
        },
        { status: getErrorStatus(error) }
      );
    }
  }

  return NextResponse.json({ error: "不支持的 GET 请求路径" }, { status: 404 });
}

/**
 * 根据错误类型确定 HTTP 状态码
 */
function getErrorStatus(error: any): number {
  if (!error) return 500;

  const message = error.message?.toLowerCase() || "";
  const status = error.status || error.statusCode;

  // 已知状态码直接返回
  if (status && typeof status === "number") {
    return status;
  }

  // 根据错误消息推断状态码
  if (message.includes("unauthorized") || message.includes("401")) {
    return 401;
  }
  if (message.includes("forbidden") || message.includes("403")) {
    return 403;
  }
  if (message.includes("not found") || message.includes("404")) {
    return 404;
  }
  if (message.includes("conflict") || message.includes("409")) {
    return 409;
  }
  if (message.includes("network") || message.includes("connection")) {
    return 502;
  }

  return 500;
}
