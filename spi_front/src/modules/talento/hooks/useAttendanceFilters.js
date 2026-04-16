import { useCallback, useEffect, useMemo, useState } from "react";
import { getDepartments } from "../../../core/api/departmentsApi";
import { attendanceDateRanges, normalizeQuickRange } from "../utils/attendanceDateRanges";

const ATTENDANCE_REPORT_MODES = Object.freeze({
  OFFICIAL: "official",
  ADMIN: "admin",
});

const ATTENDANCE_REPORT_VIEWS = Object.freeze({
  TABLE: "table",
  MAP: "map",
});

const normalizeMode = (value) => (String(value || "").trim().toLowerCase() === "admin" ? "admin" : "official");

const normalizeView = (value) => (String(value || "").trim().toLowerCase() === "map" ? "map" : "table");

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const normalizeBooleanFlag = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "si", "sí", "y", "on"].includes(normalized);
};

const normalizeUserIds = (value) => {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
};

const normalizeDepartmentId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : "";
};

const STORAGE_KEY = "attendanceReports:filters";

const toQueryValue = (value) => {
  if (Array.isArray(value)) return value.join(",");
  return String(value || "");
};

const readStoredFilters = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const readQueryFilters = () => {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    if (![...params.keys()].length) return null;
    return {
      startDate: params.get("start") || "",
      endDate: params.get("end") || "",
      mode: params.get("mode") || "",
      view: params.get("view") || "",
      status: params.get("status") || "",
      userIds: params.get("userIds") || "",
      quickRange: params.get("quickRange") || "",
    };
  } catch (_error) {
    return null;
  }
};

const useAttendanceFilters = (initialState = {}) => {
  const storedFilters = useMemo(() => readStoredFilters(), []);
  const queryFilters = useMemo(() => readQueryFilters(), []);
  const initialFilters = queryFilters || storedFilters || initialState;

  const [startDate, setStartDate] = useState(String(initialFilters.startDate || ""));
  const [endDate, setEndDate] = useState(String(initialFilters.endDate || ""));
  const [mode, setMode] = useState(normalizeMode(initialFilters.mode));
  const [view, setView] = useState(normalizeView(initialFilters.view));
  const [status, setStatus] = useState(normalizeStatus(initialFilters.status));
  const [userIds, setUserIds] = useState(() => normalizeUserIds(initialFilters.userIds));
  const [quickRange, setQuickRange] = useState(normalizeQuickRange(initialFilters.quickRange));
  const [onlyDiscrepancies, setOnlyDiscrepancies] = useState(normalizeBooleanFlag(initialFilters.onlyDiscrepancies));
  const [onlyWithGeo, setOnlyWithGeo] = useState(normalizeBooleanFlag(initialFilters.onlyWithGeo));
  const [departmentId, setDepartmentId] = useState(normalizeDepartmentId(initialFilters.departmentId));
  const [departmentOptions, setDepartmentOptions] = useState([]);

  const resetFilters = useCallback((nextState = {}) => {
    setStartDate(String(nextState.startDate || ""));
    setEndDate(String(nextState.endDate || ""));
    setMode(normalizeMode(nextState.mode));
    setView(normalizeView(nextState.view));
    setStatus(normalizeStatus(nextState.status));
    setUserIds(normalizeUserIds(nextState.userIds));
    setQuickRange(normalizeQuickRange(nextState.quickRange));
    setOnlyDiscrepancies(normalizeBooleanFlag(nextState.onlyDiscrepancies));
    setOnlyWithGeo(normalizeBooleanFlag(nextState.onlyWithGeo));
    setDepartmentId(normalizeDepartmentId(nextState.departmentId));
  }, []);

  const applyQuickRange = useCallback(
    (rangeKey, baseDate = new Date()) => {
      const normalizedRange = normalizeQuickRange(rangeKey);
      if (!normalizedRange) return;

      const rangeStart = attendanceDateRanges[normalizedRange]?.(baseDate) || "";
      const rangeEnd = attendanceDateRanges.today(baseDate);

      setQuickRange(normalizedRange);
      setStartDate(rangeStart);
      setEndDate(rangeEnd);
    },
    []
  );

  const clearFilters = useCallback(() => {
    resetFilters({
      startDate: "",
      endDate: "",
      mode: ATTENDANCE_REPORT_MODES.OFFICIAL,
      view: ATTENDANCE_REPORT_VIEWS.TABLE,
      status: "",
      userIds: [],
      onlyDiscrepancies: false,
      onlyWithGeo: false,
      departmentId: "",
    });
  }, [resetFilters]);

  const persistFilters = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          startDate,
          endDate,
          mode,
          view,
          status,
          userIds,
          quickRange,
          onlyDiscrepancies,
          onlyWithGeo,
          departmentId,
        })
      );
    } catch (_error) {
      // Ignore storage failures in restricted environments.
    }
  }, [departmentId, endDate, mode, onlyDiscrepancies, onlyWithGeo, quickRange, startDate, status, userIds, view]);

  const syncQueryParams = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      params.set("start", startDate || "");
      params.set("end", endDate || "");
      params.set("mode", mode || "");
      params.set("view", view || "");
      if (status) params.set("status", status);
      else params.delete("status");
      if (userIds.length) params.set("userIds", toQueryValue(userIds));
      else params.delete("userIds");
      if (quickRange) params.set("quickRange", quickRange);
      else params.delete("quickRange");
      if (onlyDiscrepancies) params.set("onlyDiscrepancies", "1");
      else params.delete("onlyDiscrepancies");
      if (onlyWithGeo) params.set("onlyWithGeo", "1");
      else params.delete("onlyWithGeo");
      if (departmentId) params.set("departmentId", String(departmentId));
      else params.delete("departmentId");

      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", nextUrl);
    } catch (_error) {
      // Ignore URL sync failures in restricted environments.
    }
  }, [departmentId, endDate, mode, onlyDiscrepancies, onlyWithGeo, quickRange, startDate, status, userIds, view]);

  const clearStoredFilters = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Ignore storage failures in restricted environments.
    }
  }, []);

  useEffect(() => {
    persistFilters();
  }, [persistFilters]);

  useEffect(() => {
    syncQueryParams();
  }, [syncQueryParams]);

  useEffect(() => {
    if (mode === ATTENDANCE_REPORT_MODES.OFFICIAL && status) {
      setStatus("");
      setUserIds([]);
      setQuickRange("");
    }
    if (mode === ATTENDANCE_REPORT_MODES.ADMIN && !userIds.length) {
      setUserIds([]);
    }
  }, [mode, status, userIds.length]);

  const filters = useMemo(
    () => ({
      startDate,
      endDate,
      mode,
      view,
      status,
      userIds,
      selectedUserIds: userIds,
      quickRange,
      onlyDiscrepancies,
      onlyWithGeo,
      departmentId,
    }),
    [startDate, endDate, mode, view, status, userIds, quickRange, onlyDiscrepancies, onlyWithGeo, departmentId]
  );

  useEffect(() => {
    let mounted = true;
    const loadDepartments = async () => {
      try {
        const departments = await getDepartments({ include_inactive: true });
        if (!mounted) return;
        setDepartmentOptions(
          (Array.isArray(departments) ? departments : []).map((department) => ({
            label: department.name || department.department_name || `Departamento #${department.id}`,
            value: String(department.id),
          }))
        );
      } catch (_error) {
        if (mounted) setDepartmentOptions([]);
      }
    };

    loadDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  return {
    ...filters,
    setStartDate,
    setEndDate,
    setMode,
    setView,
    setStatus,
    setUserIds,
    setSelectedUserIds: setUserIds,
    setQuickRange,
    setOnlyDiscrepancies,
    setOnlyWithGeo,
    setDepartmentId,
    resetFilters,
    clearFilters,
    persistFilters,
    clearStoredFilters,
    applyQuickRange,
    ATTENDANCE_REPORT_MODES,
    ATTENDANCE_REPORT_VIEWS,
    departmentId,
    departmentOptions,
  };
};

export default useAttendanceFilters;
export {
  ATTENDANCE_REPORT_MODES,
  ATTENDANCE_REPORT_VIEWS,
  normalizeMode,
  normalizeStatus,
  normalizeUserIds,
  normalizeView,
  normalizeBooleanFlag,
  normalizeDepartmentId,
};
