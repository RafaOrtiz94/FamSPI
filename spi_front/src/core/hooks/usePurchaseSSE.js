import { useEffect, useRef } from "react";
import { subscribeToPurchaseUpdates } from "../services/purchaseEvents";
import { subscribeToPrivatePurchaseUpdates } from "../services/privatePurchaseEvents";

const SUBSCRIBERS = {
  public: subscribeToPurchaseUpdates,
  private: subscribeToPrivatePurchaseUpdates,
};

export const usePurchaseSSE = ({
  type,
  onEvent,
  debounceMs = 8000,
  enabled = true,
  filter,
} = {}) => {
  const onEventRef = useRef(onEvent);
  const filterRef = useRef(filter);
  const timerRef = useRef(null);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!type || !SUBSCRIBERS[type]) return undefined;
    if (typeof window === "undefined") return undefined;

    const handler = (payload) => {
      const currentFilter = filterRef.current;
      if (currentFilter && !currentFilter(payload)) return;

      const currentHandler = onEventRef.current;
      if (typeof currentHandler !== "function") return;

      if (debounceMs <= 0) {
        currentHandler(payload);
        return;
      }

      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        currentHandler(payload);
      }, debounceMs);
    };

    const unsubscribe = SUBSCRIBERS[type](handler);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [type, enabled, debounceMs]);
};
