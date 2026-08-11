import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { api } from "../../convex/_generated/api";

export function useAuthGuard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const meta = useQuery(
    api.users.getMyMeta,
    !isPending && !!session ? {} : "skip"
  );

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.push("/sign-in");
      return;
    }
    if (meta?.mustChangePassword) {
      router.push("/change-password");
    }
  }, [isPending, session, meta, router]);

  // meta === null means Convex JWT not synced yet (safeGetAuthUser returned null)
  // keep loading until meta is a real object
  const loading =
    isPending ||
    !session ||
    meta === undefined ||
    meta === null ||
    meta.mustChangePassword === true;

  return { session: session!, loading, isAdmin: meta?.isAdmin ?? false };
}
