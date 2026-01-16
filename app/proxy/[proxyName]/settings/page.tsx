"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { withBasePath } from "@/lib/basePath";

interface ProxyServer {
  id: number;
  name: string;
  targetUrl: string;
  description: string | null;
  visibility: "PUBLIC" | "PRIVATE";
}

interface ProxyOwner {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface ProxyMember {
  id: number;
  role: "OWNER" | "EDITOR";
  createdAt: string;
  user: ProxyOwner;
}

interface ProxyInvite {
  id: number;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  createdAt: string;
  invitedBy: ProxyOwner;
}

export default function ProxySettingsPage() {
  const params = useParams();
  const proxyName = params.proxyName as string;
  const { data: session, status } = useSession();

  const [proxyServer, setProxyServer] = useState<ProxyServer | null>(null);
  const [owner, setOwner] = useState<ProxyOwner | null>(null);
  const [members, setMembers] = useState<ProxyMember[]>([]);
  const [invites, setInvites] = useState<ProxyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [memberRemovingId, setMemberRemovingId] = useState<number | null>(null);
  const [inviteRemovingId, setInviteRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!session?.user?.id || !owner?.id) return false;
    return session.user.id === owner.id;
  }, [session?.user?.id, owner?.id]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAll();
    }
  }, [status, proxyName]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchProxyServer(), fetchMembers(), fetchInvites()]);
    } catch {
      setError("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProxyServer = async () => {
    const response = await fetch(withBasePath(`/api/proxy/${proxyName}`));
    if (!response.ok) {
      throw new Error("프록시 서버 정보를 불러오지 못했습니다.");
    }
    const data = await response.json();
    setProxyServer(data);
  };

  const fetchMembers = async () => {
    const response = await fetch(
      withBasePath(`/api/proxy/${proxyName}/members`)
    );
    if (!response.ok) {
      throw new Error("멤버 정보를 불러오지 못했습니다.");
    }
    const data = await response.json();
    setOwner(data.owner);
    setMembers(data.members || []);
  };

  const fetchInvites = async () => {
    const response = await fetch(
      withBasePath(`/api/proxy/${proxyName}/invites`)
    );

    if (!response.ok) {
      if (response.status === 403) {
        setInvites([]);
        return;
      }
      throw new Error("초대 정보를 불러오지 못했습니다.");
    }

    const data = await response.json();
    setInvites(data);
  };

  const updateVisibility = async (visibility: "PUBLIC" | "PRIVATE") => {
    if (!proxyServer) return;

    try {
      setSavingVisibility(true);
      const response = await fetch(
        withBasePath(`/api/proxy/${proxyName}/visibility`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "공개 설정 변경에 실패했습니다.");
      }

      const result = await response.json();
      setProxyServer(result.proxyServer);
    } catch (error) {
      console.error("공개 설정 변경 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "공개 설정 변경 중 오류가 발생했습니다."
      );
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      alert("초대할 이메일을 입력해주세요.");
      return;
    }

    try {
      setInviteSubmitting(true);
      const response = await fetch(
        withBasePath(`/api/proxy/${proxyName}/invites`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "초대에 실패했습니다.");
      }

      setInviteEmail("");
      await fetchInvites();
      alert("초대가 완료되었습니다.");
    } catch (error) {
      console.error("초대 생성 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "초대 생성 중 오류가 발생했습니다."
      );
    } finally {
      setInviteSubmitting(false);
    }
  };

  const removeMember = async (memberId: number) => {
    if (!confirm("해당 멤버를 삭제하시겠습니까?")) return;

    try {
      setMemberRemovingId(memberId);
      const response = await fetch(
        withBasePath(`/api/proxy/${proxyName}/members`),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "멤버 삭제에 실패했습니다.");
      }

      setMembers((prev) => prev.filter((member) => member.id !== memberId));
    } catch (error) {
      console.error("멤버 삭제 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "멤버 삭제 중 오류가 발생했습니다."
      );
    } finally {
      setMemberRemovingId(null);
    }
  };

  const revokeInvite = async (inviteId: number) => {
    if (!confirm("초대를 취소하시겠습니까?")) return;

    try {
      setInviteRemovingId(inviteId);
      const response = await fetch(
        withBasePath(`/api/proxy/${proxyName}/invites`),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "초대 취소에 실패했습니다.");
      }

      await fetchInvites();
    } catch (error) {
      console.error("초대 취소 오류:", error);
      alert(
        error instanceof Error
          ? error.message
          : "초대 취소 중 오류가 발생했습니다."
      );
    } finally {
      setInviteRemovingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !proxyServer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">오류 발생</h3>
          <p className="text-gray-600 mb-4">
            {error || "프록시 서버를 찾을 수 없습니다."}
          </p>
          <Link
            href="/proxy"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            프록시 서버 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const nonOwnerMembers = members.filter(
    (member) => member.user.id !== owner?.id
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {proxyServer.name} 설정
            </h1>
            <p className="text-gray-600">{proxyServer.targetUrl}</p>
          </div>
          <Link
            href="/proxy"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ← 프록시 서버 목록
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">공개 설정</h3>
          {isOwner ? (
            <div className="flex items-center space-x-3">
              <select
                value={proxyServer.visibility}
                onChange={(e) =>
                  updateVisibility(e.target.value as "PUBLIC" | "PRIVATE")
                }
                disabled={savingVisibility}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PRIVATE">비공개 (초대된 사용자만)</option>
                <option value="PUBLIC">공개 (로그인 사용자 누구나)</option>
              </select>
              {savingVisibility && (
                <span className="text-xs text-gray-500">변경 중...</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              현재 설정: {proxyServer.visibility === "PRIVATE" ? "비공개" : "공개"}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">멤버</h3>
          {owner && (
            <div className="border border-gray-200 rounded-md p-3 mb-3">
              <div className="text-xs text-gray-500 mb-1">소유자</div>
              <div className="text-sm font-medium text-gray-900">
                {owner.name || owner.email}
              </div>
            </div>
          )}

          {nonOwnerMembers.length === 0 ? (
            <p className="text-sm text-gray-500">추가된 멤버가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {nonOwnerMembers.map((member) => (
                <li
                  key={member.id}
                  className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {member.user.name || member.user.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      권한: {member.role === "OWNER" ? "소유자" : "멤버"}
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={memberRemovingId === member.id}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        memberRemovingId === member.id
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      삭제
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">초대</h3>
          {isOwner ? (
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="초대할 이메일"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleInvite}
                disabled={inviteSubmitting}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  inviteSubmitting
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                초대 보내기
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-4">
              초대 관리는 소유자만 가능합니다.
            </p>
          )}

          {invites.length === 0 ? (
            <p className="text-sm text-gray-500">진행 중인 초대가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="border border-gray-200 rounded-md p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {invite.email}
                    </div>
                    <div className="text-xs text-gray-500">
                      상태: {invite.status}
                    </div>
                  </div>
                  {isOwner && invite.status === "PENDING" && (
                    <button
                      onClick={() => revokeInvite(invite.id)}
                      disabled={inviteRemovingId === invite.id}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        inviteRemovingId === invite.id
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      취소
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

