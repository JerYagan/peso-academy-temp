import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider, useLocale } from "@/contexts/LocaleContext";
import { LANGUAGE_STORAGE_KEY } from "@/i18n/types";
import type { User } from "@/types/auth";

const updateUserMock = vi.fn();
let mockedUser: User | null = null;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: mockedUser,
    updateUser: updateUserMock,
  }),
}));

const LocaleProbe = () => {
  const { getMessage, language, setLanguage, t } = useLocale();
  const afterSignupSteps = getMessage<string[]>("signup.afterSignupSteps");

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="login-label">{t("login.submit")}</span>
      <span data-testid="signup-step">{afterSignupSteps[0]}</span>
      <button type="button" onClick={() => void setLanguage("tl")}>Switch</button>
    </div>
  );
};

describe("LocaleContext", () => {
  beforeEach(() => {
    mockedUser = null;
    updateUserMock.mockReset();
    window.localStorage.clear();
  });

  it("hydrates the initial language from local storage", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "tl");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("language")).toHaveTextContent("tl");
    expect(screen.getByTestId("login-label")).toHaveTextContent("Mag-login");
  });

  it("returns structured translated arrays for learner-facing copy", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "tl");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("signup-step")).toHaveTextContent(
      "1. Magagawa ang iyong trainee account at dadalhin ka sa dashboard.",
    );
  });

  it("persists language changes to local storage and the signed-in profile", async () => {
    mockedUser = {
      id: "user-1",
      email: "learner@example.com",
      name: "Learner",
      role: "trainee",
      languagePreference: "en",
    } as User;

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ languagePreference: "tl" });
    });

    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("tl");
    expect(screen.getByTestId("language")).toHaveTextContent("tl");
  });
});