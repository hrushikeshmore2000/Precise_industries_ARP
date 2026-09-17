import { useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Subscribe to Postgres change events on a table filtered by organization_id.
 * Callback fires for each change.
 */
export function useRealtime(table, orgId, callback, deps = []) {
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`rt-${table}-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `organization_id=eq.${orgId}` },
        (payload) => callback(payload)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, orgId, ...deps]);
}
