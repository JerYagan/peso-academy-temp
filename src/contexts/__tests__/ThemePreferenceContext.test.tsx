import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemePreferenceProvider, useThemePreference } from "@/contexts/ThemePreferenceContext";
import type { User } from "@/types/auth";

const updateUserMock = vi.fn();
const setThemeMock = vi.fn((nextTheme: string) => {
  mockedTheme = nextTheme;
});

let mockedUser: User | null = null;
let mockedTheme: string | undefined = "system";
let mockedResolvedTheme: string | undefined = "light";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockedUser,
    updateUser: updateUserMock,
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockedTheme,
    resolvedTheme: mockedResolvedTheme,
    setTheme: setThemeMock,
  }),
}));

const ThemeProbe = () => {
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <div>
      <span data-testid="theme-preference">{themePreference}</span>
      <button type="button" onClick={() => void setThemePreference("dark")}>Switch theme</button>
    </div>
  );
};

describe("ThemePreferenceContext", () => {
  beforeEach(() => {
    mockedUser = null;
    mockedTheme = "system";
    mockedResolvedTheme = "light";
    updateUserMock.mockReset();
    setThemeMock.mockClear();
  });

  it("applies the signed-in user's saved theme on hydration", () => {
    mockedUser = {
      id: "user-1",
      email: "learner@example.com",
      name: "Learner",
      role: "trainee",
      themePreference: "dark",
    } as User;
    mockedTheme = "light";
    mockedResolvedTheme = "light";

    render(
      <ThemePreferenceProvider>
        <ThemeProbe />
      </ThemePreferenceProvider>,
    );

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("persists theme changes to the signed-in profile", async () => {
    mockedUser = {
      id: "user-1",
      email: "learner@example.com",
      name: "Learner",
      role: "trainee",
      themePreference: "light",
    } as User;
    mockedTheme = "light";
    mockedResolvedTheme = "light";

    render(
      <ThemePreferenceProvider>
        <ThemeProbe />
      </ThemePreferenceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch theme" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ themePreference: "dark" });
    });

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });
});