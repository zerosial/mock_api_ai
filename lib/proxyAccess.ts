import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ProxyVisibility } from "@/lib/generated/prisma";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

type AccessResult = {
  proxyServer: {
    id: number;
    name: string;
    targetUrl: string;
    description: string | null;
    isActive: boolean;
    visibility: ProxyVisibility;
    ownerId: string;
  };
  isPublic: boolean;
  isOwner: boolean;
  isMember: boolean;
  canAccess: boolean;
};

export async function requireAuthUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.email) {
    return {
      errorResponse: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    } satisfies AuthUser,
  };
}

export async function getOptionalAuthUser(): Promise<AuthUser | null> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
  } satisfies AuthUser;
}

export async function getProxyAccessByName(
  proxyName: string,
  userId?: string
): Promise<{ data?: AccessResult; errorResponse?: NextResponse }> {
  const proxyServer = await prisma.proxyServer.findUnique({
    where: { name: proxyName },
  });

  if (!proxyServer) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }
  if (!proxyServer.isActive) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }

  const isOwner = Boolean(userId && proxyServer.ownerId === userId);
  const isMember = Boolean(
    userId &&
      (await prisma.proxyServerMember.findUnique({
        where: {
          proxyServerId_userId: {
            proxyServerId: proxyServer.id,
            userId,
          },
        },
      }))
  );

  const isPublic = proxyServer.visibility === ProxyVisibility.PUBLIC;
  const canAccess = isPublic || isOwner || isMember;

  if (!canAccess) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버에 대한 접근 권한이 없습니다." },
        { status: userId ? 403 : 401 }
      ),
    };
  }

  return {
    data: {
      proxyServer,
      isPublic,
      isOwner,
      isMember,
      canAccess,
    },
  };
}

export async function getProxyAccessById(
  proxyServerId: number,
  userId?: string
): Promise<{ data?: AccessResult; errorResponse?: NextResponse }> {
  const proxyServer = await prisma.proxyServer.findUnique({
    where: { id: proxyServerId },
  });

  if (!proxyServer) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }
  if (!proxyServer.isActive) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버를 찾을 수 없습니다." },
        { status: 404 }
      ),
    };
  }

  const isOwner = Boolean(userId && proxyServer.ownerId === userId);
  const isMember = Boolean(
    userId &&
      (await prisma.proxyServerMember.findUnique({
        where: {
          proxyServerId_userId: {
            proxyServerId: proxyServer.id,
            userId,
          },
        },
      }))
  );

  const isPublic = proxyServer.visibility === ProxyVisibility.PUBLIC;
  const canAccess = isPublic || isOwner || isMember;

  if (!canAccess) {
    return {
      errorResponse: NextResponse.json(
        { error: "프록시 서버에 대한 접근 권한이 없습니다." },
        { status: userId ? 403 : 401 }
      ),
    };
  }

  return {
    data: {
      proxyServer,
      isPublic,
      isOwner,
      isMember,
      canAccess,
    },
  };
}

