export const getOfficialCourseHoursText = (durationHours: number) => {
  const safeHours = Math.max(0, Math.round(Number(durationHours) || 0));
  return `${safeHours}h`;
};

export const getOfficialHoursCreditLabel = (durationHours: number) => {
  return getOfficialCourseHoursText(durationHours);
};

export const getFlexibleCourseDurationLabel = (durationHours: number) => {
  return getOfficialCourseHoursText(durationHours);
};