import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAttendanceRange, getAttendanceTeamRange } from "../../../core/api/attendanceApi";

const normalizeFiltersForKey = (filters = {}) => {
  const userIds = Array.isArray(filters.userIds)
    ? [...new Set(filters.userIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
    : [];

  return {
    startDate: String(filters.startDate || ""),
    endDate: String(filters.endDate || ""),
    userId: filters.userId ?? "",
    userIds,
    departmentId: filters.departmentId ?? "",
    status: String(filters.status || ""),
    quickRange: String(filters.quickRange || ""),
    onlyDiscrepancies: Boolean(filters.onlyDiscrepancies),
    onlyWithGeo: Boolean(filters.onlyWithGeo),
    mode: String(filters.mode || ""),
    view: String(filters.view || ""),
  };
};

const useAttendanceReportsQuery = ({ filters = {}, enabled = false, signal } = {}) => {
  const normalizedFilters = useMemo(() => normalizeFiltersForKey(filters), [filters]);

  const query = useQuery({
    queryKey: ["attendance-reports", "range", normalizedFilters],
    queryFn: async ({ signal: querySignal }) =>
      normalizedFilters.mode === "team"
        ? getAttendanceTeamRange(normalizedFilters, querySignal)
        : getAttendanceRange(normalizedFilters, querySignal),
    enabled: Boolean(enabled && normalizedFilters.startDate && normalizedFilters.endDate),
    staleTime: 1000 * 30,
    cancelRefetch: true,
    placeholderData: (previousData) => previousData,
  });

  const isInitialLoading = query.isLoading && !query.data;
  const isRefetching = query.isFetching && query.data;
  const isError = query.isError;
  const warning = query.data?.meta?.warnings?.[0] || null;

  return {
    ...query,
    isInitialLoading,
    isRefetching,
    isError,
    warning,
    rows: Array.isArray(query.data?.data) ? query.data.data : [],
    summary: query.data?.summary || null,
    meta: query.data?.meta || null,
    normalizedFilters,
  };
};

export default useAttendanceReportsQuery;
export { normalizeFiltersForKey };
