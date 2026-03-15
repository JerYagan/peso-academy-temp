import { Course } from "@/types";
import { User } from "@/types/auth";

const isStaffUser = (user?: Pick<User, "role"> | null) => user?.role === "admin" || user?.role === "trainer";

export const canUserViewCourse = (
  course: Pick<Course, "published" | "traineeAudience">,
  user?: Pick<User, "role" | "traineeType"> | null,
): boolean => {
  if (isStaffUser(user)) {
    return true;
  }

  if (course.published === false) {
    return false;
  }

  if (course.traineeAudience === "general_public") {
    return true;
  }

  if (!user || user.role !== "trainee") {
    return false;
  }

  return user.traineeType === course.traineeAudience;
};

export const filterCoursesForUser = <TCourse extends Pick<Course, "published" | "traineeAudience">>(
  courses: TCourse[],
  user?: Pick<User, "role" | "traineeType"> | null,
): TCourse[] => courses.filter((course) => canUserViewCourse(course, user));
