import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { applyProject26Ui, readProject26Ui } from "@/lib/project26Ui";

export function Project26UiSync() {
  const { user } = useAuth();
  useEffect(() => {
    applyProject26Ui(readProject26Ui(user?.user_metadata?.project26_ui));
  }, [user?.user_metadata]);
  return null;
}
