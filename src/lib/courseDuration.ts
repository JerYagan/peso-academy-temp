export const getOfficialCourseHoursText = (durationHours: number) => {
  const safeHours = Math.max(0, Math.round(Number(durationHours) || 0));
  return `${safeHours} official ${safeHours === 1 ? "hour" : "hours"}`;
};

export const getOfficialHoursCreditLabel = (durationHours: number) => {
  return `Credits ${getOfficialCourseHoursText(durationHours)} after approval`;
};

export const getFlexibleCourseDurationLabel = (durationHours: number) => {
  const safeHours = Math.max(1, Math.round(Number(durationHours) || 1));
  const weeks = Math.max(1, Math.round(safeHours / 10));
  return `Flexible pace · about ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
};